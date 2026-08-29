import 
{
 Router, type IRouter, type Request, type Response 
}
 from "express"
;

import 
{
 and, count, desc, eq, inArray, isNull, sql 
}
 from "drizzle-orm"
;

import 
{
 alias 
}
 from "drizzle-orm/pg-core"
;

import * as V from "@workspace/api-zod"
;

import 
{
 aidRecipientsTable, aidsTable, auditEventsTable, complaintsTable, contactRequestsTable, contentPostsTable, db, displacedPersonsTable, mediaReferencesTable, notificationsTable, securityTaskAssigneesTable, securityTasksTable, sessionsTable, usersTable 
}
 from "@workspace/db"
;

import 
{
 apiRole, hashToken, newToken, optionalAuth, requireAuth, requireRoles 
}
 from "../middlewares/auth"
;

import 
{
 hashPassword, verifyPassword 
}
 from "../lib/security"
;


const router: IRouter = Router()
;

router.use(optionalAuth)
;

const bad = (res: Response, error: unknown) => 
{
 res.status(400).json(
{
 error: "Invalid request", message: error instanceof Error ? error.message : undefined 
}
)
;
 
}
;

const parse = <T>(schema: 
{
 safeParse(x: unknown): 
{
 success: boolean
;
 data?: T
;
 error?: Error 
}
 
}
, value: unknown, res: Response): T | undefined => 
{

  const result = schema.safeParse(value)
;
 if (!result.success) 
{
 bad(res, result.error)
;
 return undefined
;
 
}
 return result.data
;

}
;

const page = async (query: unknown, schema: any, table: any, response: any, where?: any) => 
{

  const q = schema.parse(query)
;
 const [
{
 total 
}
] = await db.select(
{
 total: count() 
}
).from(table).where(where)
;

  const items = await db.select().from(table).where(where).orderBy(desc(table.createdAt)).limit(q.limit).offset((q.page - 1) * q.limit)
;

  return response.parse(
{
 items: items.map(map(table)), pagination: 
{
 page: q.page, limit: q.limit, totalItems: total, totalPages: Math.ceil(total / q.limit) 
}
 
}
)
;

}
;

const audit = (userId: number, action: string, entityType: string, entityId: number) => db.insert(auditEventsTable).values(
{
 actorUserId: userId, action, entityType, entityId 
}
)
;

const map = (table: any) => (row: any): any => 
{

  if (table === aidsTable) return {
 ...row, quantity: row.targetFamilies, recipientCount: row.recipientCount ?? 0, status: ({ DRAFT: "planned", ACTIVE: "active", COMPLETED: "completed", CANCELLED: "cancelled" } as any)[row.status], distributionDate: row.startsAt 
}
;

  if (table === complaintsTable) return {
 ...row, message: row.body, displacedPersonId: row.displacedPersonId ?? null, status: ({ PENDING: "open", IN_PROGRESS: "inProgress", RESOLVED: "resolved", REJECTED: "closed" } as any)[row.status] 
}
;

  if (table === securityTasksTable) return {
 ...row, description: row.body, assignedToId: row.assignedToId ?? null, status: ({ UPCOMING: "pending", IN_PROGRESS: "inProgress", COMPLETED: "completed", CANCELLED: "completed" } as any)[row.status] 
}
;

  if (table === notificationsTable) return {
 ...row, message: row.body, read: !!row.readAt 
}
;

  if (table === contentPostsTable) return {
 ...row, imageUrl: null, status: row.status === "PUBLISHED" ? "published" : "draft" 
}
;

  return row
;

}
;

const id = (req: Request, res: Response, schema: any) => parse<any>(schema, req.params, res)?.id
;

const manager = requireRoles("manager")
;

const displacedScope = (req: Request) => req.authUser!.role === "MANAGER" ? undefined : req.authUser!.role === "DELEGATE" ? eq(displacedPersonsTable.delegateUserId, req.authUser!.id) : req.authUser!.role === "DISPLACED" ? eq(displacedPersonsTable.userId, req.authUser!.id) : sql`false`
;


router.post("/auth/login", async (req, res): Promise<void> => 
{

  const input = parse<any>(V.LoginBody, req.body, res)
;
 if (!input) return
;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, input.email))
;

  const isDevelopmentDemo = user?.identity.startsWith("dev-") ||
    user?.email.endsWith("@alaqsa.local") ||
    user?.email.endsWith("@local.invalid")
;
  if (!user || !user.active || (process.env.NODE_ENV === "production" && isDevelopmentDemo) || apiRole(user) !== input.role || !(await verifyPassword(input.password, user.passwordHash)))
{
 res.status(401).json(
{
 error: "Invalid credentials" 
}
)
;
 return
;
 
}

  const token = newToken(), expiresAt = new Date(Date.now() + 7 * 86400000)
;

  await db.insert(sessionsTable).values(
{
 userId: user.id, tokenHash: hashToken(token), expiresAt 
}
)
;

  res.cookie("aqsa_session", token, 
{
 httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: expiresAt 
}
)
;

  res.json(V.LoginResponse.parse(
{
 user: 
{
 id: user.id, name: user.name, email: user.email, role: apiRole(user), phone: user.phoneNumber, createdAt: user.createdAt 
}
, token, expiresAt 
}
))
;

}
)
;

router.get("/auth/session", requireAuth, async (req, res): Promise<void> => 
{
 const u = req.authUser!
;
 res.json(V.GetSessionResponse.parse(
{
 user: 
{
 id:u.id,name:u.name,email:u.email,role:apiRole(u),phone:u.phoneNumber,createdAt:u.createdAt 
}
, token:req.sessionToken, expiresAt:new Date(Date.now()+7*86400000) 
}
))
;
 
}
)
;

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => 
{
 await db.update(sessionsTable).set(
{
 revokedAt:new Date() 
}
).where(eq(sessionsTable.tokenHash, hashToken(req.sessionToken!)))
;
 res.clearCookie("aqsa_session")
;
 res.json(V.LogoutResponse.parse(
{
success:true,message:"Logged out"
}
))
;
 
}
)
;


router.get("/dashboard", requireAuth, async (req, res): Promise<void> => 
{

  const q = async (t:any, w?:any) => Number((await db.select(
{
n:count()
}
).from(t).where(w))[0].n)
;

  res.json(V.GetDashboardResponse.parse(
{
 totalDelegates:await q(usersTable,eq(usersTable.role,"DELEGATE")), totalDisplacedPersons:await q(displacedPersonsTable), activeAids:await q(aidsTable,eq(aidsTable.status,"ACTIVE")), openComplaints:await q(complaintsTable,inArray(complaintsTable.status,["PENDING","IN_PROGRESS"])), unreadNotifications:await q(notificationsTable,and(eq(notificationsTable.recipientUserId,req.authUser!.id),isNull(notificationsTable.readAt))) 
}
))
;

}
)
;


router.get("/delegates", manager, async (req,res):Promise<void>=> 
{
 const q=parse<any>(V.ListDelegatesQueryParams,req.query,res)
;
 if(!q)return
;
 const rows=await db.select().from(usersTable).where(eq(usersTable.role,"DELEGATE")).limit(q.limit).offset((q.page-1)*q.limit)
;
 const [
{
n
}
]=await db.select(
{
n:count()
}
).from(usersTable).where(eq(usersTable.role,"DELEGATE"))
;
 res.json(V.ListDelegatesResponse.parse(
{
items:rows.map(u=>(
{
id:u.id,name:u.name,email:u.email,phone:u.phoneNumber??"",area:null,status:u.active?"active":"inactive",createdAt:u.createdAt
}
)),pagination:
{
page:q.page,limit:q.limit,totalItems:Number(n),totalPages:Math.ceil(Number(n)/q.limit)
}
}
))
;
 
}
)
;

router.post("/delegates",manager,async(req,res):Promise<void>=>
{
const b=parse<any>(V.CreateDelegateBody,req.body,res)
;
if(!b)return
;
const u=await db.transaction(async tx=>(await tx.insert(usersTable).values(
{
name:b.name,email:b.email,phoneNumber:b.phone,role:"DELEGATE",rank:"DELEGATE",identity:`delegate-${newToken()}`,passwordHash:await hashPassword(newToken()),active:true
}
).returning())[0])
;
await audit(req.authUser!.id,"CREATE","delegate",u.id)
;
res.status(201).json(V.CreateDelegateResponse.parse(
{
id:u.id,name:u.name,email:u.email,phone:u.phoneNumber??"",area:b.area,status:"active",createdAt:u.createdAt
}
))
;
}
)
;

router.get("/delegates/:id",requireAuth,async(req,res):Promise<void>=>
{
const x=id(req,res,V.GetDelegateParams)
;
if(x===undefined)return
;
if(req.authUser!.role!=="MANAGER"&&req.authUser!.id!==x)
{
res.status(403).json(
{
error:"Insufficient permissions"
}
)
;
return
;
}
const [u]=await db.select().from(usersTable).where(and(eq(usersTable.id,x),eq(usersTable.role,"DELEGATE")))
;
if(!u)
{
res.status(404).json(
{
error:"Not found"
}
)
;
return
;
}
res.json(V.GetDelegateResponse.parse(
{
id:u.id,name:u.name,email:u.email,phone:u.phoneNumber??"",area:null,status:u.active?"active":"inactive",createdAt:u.createdAt
}
))
;
}
)
;

router.patch("/delegates/:id",manager,async(req,res):Promise<void>=>
{
const x=id(req,res,V.UpdateDelegateParams),b=parse<any>(V.UpdateDelegateBody,req.body,res)
;
if(x===undefined||!b)return
;
const [u]=await db.update(usersTable).set(
{
name:b.name,email:b.email,phoneNumber:b.phone,active:b.status?b.status==="active":undefined
}
).where(and(eq(usersTable.id,x),eq(usersTable.role,"DELEGATE"))).returning()
;
if(!u)
{
res.status(404).json(
{
error:"Not found"
}
)
;
return
;
}
res.json(V.UpdateDelegateResponse.parse(
{
id:u.id,name:u.name,email:u.email,phone:u.phoneNumber??"",area:b.area,status:u.active?"active":"inactive",createdAt:u.createdAt
}
))
;
}
)
;


router.get("/displaced-persons",requireAuth,async(req,res):Promise<void>=>
{
if(req.authUser!.role==="SECURITY")
{
res.status(403).json(
{
error:"Insufficient permissions"
}
)
;
return
;
}
const q=parse<any>(V.ListDisplacedPersonsQueryParams,req.query,res)
;
if(!q)return
;
const where=displacedScope(req)
;
const rows=await db.select(
{
p:displacedPersonsTable,u:usersTable
}
).from(displacedPersonsTable).innerJoin(usersTable,eq(displacedPersonsTable.userId,usersTable.id)).where(where).limit(q.limit).offset((q.page-1)*q.limit)
;
const [
{
n
}
]=await db.select(
{
n:count()
}
).from(displacedPersonsTable).where(where)
;
const items=rows.map((
{
p,u
}
)=>(
{
id:p.id,name:u.name,phone:u.phoneNumber??"",nationalId:u.identity,familySize:p.familyNumber,location:p.tentName,delegateId:p.delegateUserId,createdAt:p.createdAt
}
))
;
res.json(V.ListDisplacedPersonsResponse.parse(
{
items,pagination:
{
page:q.page,limit:q.limit,totalItems:Number(n),totalPages:Math.ceil(Number(n)/q.limit)
}
}
))
;
}
)
;

router.post("/displaced-persons",requireRoles("manager","delegate"),async(req,res):Promise<void>=>
{
const b=parse<any>(V.CreateDisplacedPersonBody,req.body,res)
;
if(!b)return
;
if(req.authUser!.role==="DELEGATE"&&b.delegateId&&b.delegateId!==req.authUser!.id)
{
res.status(403).json(
{
error:"Cannot assign another delegate"
}
)
;
return
;
}
const out=await db.transaction(async tx=>
{
const u=(await tx.insert(usersTable).values(
{
name:b.name,email:`resident-${newToken()}@local.invalid`,phoneNumber:b.phone,role:"DISPLACED",rank:"DISPLACED",identity:b.nationalId??`resident-${newToken()}`,passwordHash:await hashPassword(newToken()),active:true
}
).returning())[0]
;
const p=(await tx.insert(displacedPersonsTable).values(
{
userId:u.id,delegateUserId:b.delegateId??(req.authUser!.role==="DELEGATE"?req.authUser!.id:null),familyNumber:b.familySize,tentName:b.location
}
).returning())[0]
;
 return {
u,p
}
;
}
)
;
res.status(201).json(V.CreateDisplacedPersonResponse.parse(
{
id:out.p.id,name:out.u.name,phone:out.u.phoneNumber??"",nationalId:out.u.identity,familySize:out.p.familyNumber,location:out.p.tentName,delegateId:out.p.delegateUserId,createdAt:out.p.createdAt
}
))
;
}
)
;

router.get("/displaced-persons/:id",requireAuth,async(req,res):Promise<void>=>
{
if(req.authUser!.role==="SECURITY")
{
res.status(403).json(
{
error:"Insufficient permissions"
}
)
;
return
;
}
const x=id(req,res,V.GetDisplacedPersonParams)
;
if(x===undefined)return
;
const [r]=await db.select(
{
p:displacedPersonsTable,u:usersTable
}
).from(displacedPersonsTable).innerJoin(usersTable,eq(displacedPersonsTable.userId,usersTable.id)).where(and(eq(displacedPersonsTable.id,x),displacedScope(req)))
;
if(!r)
{
res.status(404).json(
{
error:"Not found"
}
)
;
return
;
}
res.json(V.GetDisplacedPersonResponse.parse(
{
id:r.p.id,name:r.u.name,phone:r.u.phoneNumber??"",nationalId:r.u.identity,familySize:r.p.familyNumber,location:r.p.tentName,delegateId:r.p.delegateUserId,createdAt:r.p.createdAt
}
))
;
}
)
;

router.patch("/displaced-persons/:id",requireAuth,async(req,res):Promise<void>=>
{
if(req.authUser!.role==="SECURITY")
{
res.status(403).json(
{
error:"Insufficient permissions"
}
)
;
return
;
}
const x=id(req,res,V.UpdateDisplacedPersonParams),b=parse<any>(V.UpdateDisplacedPersonBody,req.body,res)
;
if(x===undefined||!b)return
;
const [p]=await db.update(displacedPersonsTable).set(
{
familyNumber:b.familySize,tentName:b.location
}
).where(and(eq(displacedPersonsTable.id,x),displacedScope(req))).returning()
;
if(!p)
{
res.status(404).json(
{
error:"Not found"
}
)
;
return
;
}
const [u]=await db.update(usersTable).set(
{
name:b.name,phoneNumber:b.phone,identity:b.nationalId
}
).where(eq(usersTable.id,p.userId)).returning()
;
res.json(V.UpdateDisplacedPersonResponse.parse(
{
id:p.id,name:u.name,phone:u.phoneNumber??"",nationalId:u.identity,familySize:p.familyNumber,location:p.tentName,delegateId:p.delegateUserId,createdAt:p.createdAt
}
))
;
}
)
;

router.patch("/displaced-persons/:id/delegate",manager,async(req,res):Promise<void>=>
{
const x=id(req,res,V.AssignDisplacedPersonDelegateParams),b=parse<any>(V.AssignDisplacedPersonDelegateBody,req.body,res)
;
if(x===undefined||!b)return
;
if(b.delegateId!==null)
{
const [d]=await db.select().from(usersTable).where(and(eq(usersTable.id,b.delegateId),eq(usersTable.role,"DELEGATE")))
;
if(!d)
{
res.status(400).json(
{
error:"Invalid delegate"
}
)
;
return
;
}
}
const [p]=await db.update(displacedPersonsTable).set(
{
delegateUserId:b.delegateId
}
).where(eq(displacedPersonsTable.id,x)).returning()
;
if(!p)
{
res.status(404).json(
{
error:"Not found"
}
)
;
return
;
}
const[u]=await db.select().from(usersTable).where(eq(usersTable.id,p.userId))
;
res.json(V.AssignDisplacedPersonDelegateResponse.parse(
{
id:p.id,name:u.name,phone:u.phoneNumber??"",nationalId:u.identity,familySize:p.familyNumber,location:p.tentName,delegateId:p.delegateUserId,createdAt:p.createdAt
}
))
;
}
)
;

router.get("/displaced-persons/:id/aid-history",requireAuth,async(req,res):Promise<void>=>
{
if(req.authUser!.role==="SECURITY")
{
res.status(403).json(
{
error:"Insufficient permissions"
}
)
;
return
;
}
const personId=id(req,res,V.GetDisplacedPersonAidHistoryParams),q=parse<any>(V.GetDisplacedPersonAidHistoryQueryParams,req.query,res)
;
if(personId===undefined||!q)return
;
const [person]=await db.select().from(displacedPersonsTable).where(and(eq(displacedPersonsTable.id,personId),displacedScope(req)))
;
if(!person)
{
res.status(404).json(
{
error:"Not found"
}
)
;
return
;
}
const assignedBy=alias(usersTable,"aid_history_assigned_by")
;
const allocationStatus=q.status?({ assigned:"ASSIGNED",received:"RECEIVED",cancelled:"CANCELLED" } as any)[q.status]:undefined
;
const where=allocationStatus?and(eq(aidRecipientsTable.displacedPersonId,personId),eq(aidRecipientsTable.status,allocationStatus)):eq(aidRecipientsTable.displacedPersonId,personId)
;
const rows=await db.select(
{
recipient:aidRecipientsTable,aid:aidsTable,assignedBy
}
).from(aidRecipientsTable).innerJoin(aidsTable,eq(aidRecipientsTable.aidId,aidsTable.id)).innerJoin(assignedBy,eq(aidRecipientsTable.assignedBy,assignedBy.id)).where(where).orderBy(desc(aidRecipientsTable.createdAt)).limit(q.limit).offset((q.page-1)*q.limit)
;
const[
{
n
}
]=await db.select(
{
n:count()
}
).from(aidRecipientsTable).where(where)
;
res.json(V.GetDisplacedPersonAidHistoryResponse.parse(
{
items:rows.map(r=>(
{
 aidId:r.aid.id,status:({ ASSIGNED:"assigned",RECEIVED:"received",CANCELLED:"cancelled" } as any)[r.recipient.status],title:r.aid.title,type:r.aid.type,description:r.aid.description,distributionLocation:person.tentName,distributionDate:r.aid.startsAt,receivedAt:r.recipient.receivedAt,assignedBy:
{
id:r.assignedBy.id,name:r.assignedBy.name,role:r.assignedBy.role==="MANAGER"?"manager":"delegate"
}
}
)),pagination:
{
page:q.page,limit:q.limit,totalItems:Number(n),totalPages:Math.ceil(Number(n)/q.limit)
}
}
))
;
}
)
;


const aidStatus=(s:any)=>({ planned:"DRAFT",active:"ACTIVE",completed:"COMPLETED",cancelled:"CANCELLED" } as any)[s]
;

router.get("/aids",requireAuth,async(req,res):Promise<void>=>
{
const q=parse<any>(V.ListManagedAidsQueryParams,req.query,res)
;
if(!q)return
;
const rows=await db.select(
{
a:aidsTable,recipientCount:count(aidRecipientsTable.displacedPersonId)
}
).from(aidsTable).leftJoin(aidRecipientsTable,eq(aidsTable.id,aidRecipientsTable.aidId)).groupBy(aidsTable.id).limit(q.limit).offset((q.page-1)*q.limit)
;
const [
{
n
}
]=await db.select(
{
n:count()
}
).from(aidsTable)
;
res.json(V.ListManagedAidsResponse.parse(
{
items:rows.map(r=>map(aidsTable)(
{
...r.a,recipientCount:Number(r.recipientCount)
}
)),pagination:
{
page:q.page,limit:q.limit,totalItems:Number(n),totalPages:Math.ceil(Number(n)/q.limit)
}
}
))
;
}
)
;

router.post("/aids",manager,async(req,res):Promise<void>=>
{
const b=parse<any>(V.CreateManagedAidBody,req.body,res)
;
if(!b)return
;
const[a]=await db.insert(aidsTable).values(
{
title:b.title,type:b.type,description:b.description,targetFamilies:b.quantity,startsAt:b.distributionDate,createdBy:req.authUser!.id
}
).returning()
;
await audit(req.authUser!.id,"CREATE","aid",a.id)
;
res.status(201).json(V.CreateManagedAidResponse.parse(map(aidsTable)(
{
...a,recipientCount:0
}
)))
;
}
)
;

router.get("/aids/:id",requireAuth,async(req,res):Promise<void>=>
{
const x=id(req,res,V.GetAidParams)
;
if(x===undefined)return
;
const[a]=await db.select().from(aidsTable).where(eq(aidsTable.id,x))
;
if(!a)
{
res.status(404).json(
{
error:"Not found"
}
)
;
return
;
}
const[
{
n
}
]=await db.select(
{
n:count()
}
).from(aidRecipientsTable).where(eq(aidRecipientsTable.aidId,x))
;
res.json(V.GetAidResponse.parse(map(aidsTable)(
{
...a,recipientCount:Number(n)
}
)))
;
}
)
;

router.patch("/aids/:id",manager,async(req,res):Promise<void>=>
{
const x=id(req,res,V.UpdateAidParams),b=parse<any>(V.UpdateAidBody,req.body,res)
;
if(x===undefined||!b)return
;
const[a]=await db.update(aidsTable).set(
{
title:b.title,type:b.type,description:b.description,targetFamilies:b.quantity,status:b.status?aidStatus(b.status):undefined,startsAt:b.distributionDate
}
).where(eq(aidsTable.id,x)).returning()
;
if(!a)
{
res.status(404).json(
{
error:"Not found"
}
)
;
return
;
}
const[
{
n
}
]=await db.select(
{
n:count()
}
).from(aidRecipientsTable).where(eq(aidRecipientsTable.aidId,x))
;
res.json(V.UpdateAidResponse.parse(map(aidsTable)(
{
...a,recipientCount:Number(n)
}
)))
;
}
)
;

router.post("/aids/:id/recipients",requireRoles("manager","delegate"),async(req,res):Promise<void>=>
{
const x=id(req,res,V.AddAidRecipientsParams),b=parse<any>(V.AddAidRecipientsBody,req.body,res)
;
if(x===undefined||!b)return
;
const result=await db.transaction(async tx=>
{
const[a]=await tx.select().from(aidsTable).where(eq(aidsTable.id,x))
;
if(!a)return null
;
const people=await tx.select().from(displacedPersonsTable).where(inArray(displacedPersonsTable.id,b.displacedPersonIds))
;
if(people.length!==new Set(b.displacedPersonIds).size)throw new Error("A recipient was not found")
;
if(req.authUser!.role==="DELEGATE"&&people.some(p=>p.delegateUserId!==req.authUser!.id))throw new Error("Recipient is not assigned to you")
;
await tx.insert(aidRecipientsTable).values(people.map(p=>(
{
aidId:x,displacedPersonId:p.id,assignedBy:req.authUser!.id
}
))).onConflictDoNothing()
;
return a
;
}
)
;
if(!result)
{
res.status(404).json(
{
error:"Not found"
}
)
;
return
;
}
const[
{
n
}
]=await db.select(
{
n:count()
}
).from(aidRecipientsTable).where(eq(aidRecipientsTable.aidId,x))
;
res.json(V.AddAidRecipientsResponse.parse(map(aidsTable)(
{
...result,recipientCount:Number(n)
}
)))
;
}
)
;

router.post("/aids/:id/receive",requireRoles("manager","delegate"),async(req,res):Promise<void>=>
{
const x=id(req,res,V.ReceiveAidParams),b=parse<any>(V.ReceiveAidBody,req.body,res)
;
if(x===undefined||!b)return
;
const changed=await db.transaction(async tx=>
{
const[a]=await tx.select().from(aidsTable).where(eq(aidsTable.id,x))
;
if(!a)return "missing"
;
if(req.authUser!.role==="DELEGATE")
{
const[p]=await tx.select().from(displacedPersonsTable).where(and(eq(displacedPersonsTable.id,b.displacedPersonId),eq(displacedPersonsTable.delegateUserId,req.authUser!.id)))
;
if(!p)return "forbidden"
;
}
const[r]=await tx.update(aidRecipientsTable).set(
{
status:"RECEIVED",receivedAt:b.receivedAt??new Date()
}
).where(and(eq(aidRecipientsTable.aidId,x),eq(aidRecipientsTable.displacedPersonId,b.displacedPersonId),eq(aidRecipientsTable.status,"ASSIGNED"))).returning()
;
return r?"ok":"invalid"
;
}
)
;
if(changed==="missing")
{
res.status(404).json(
{
error:"Not found"
}
)
;
return
;
}
if(changed==="forbidden")
{
res.status(403).json(
{
error:"Recipient is not assigned to you"
}
)
;
return
;
}
if(changed!=="ok")
{
res.status(400).json(
{
error:"Recipient is not assigned or already received"
}
)
;
return
;
}
res.json(V.ReceiveAidResponse.parse(
{
success:true,message:"Receipt recorded"
}
))
;
}
)
;


const complaintStatus=(s:any)=>({ open:"PENDING",inProgress:"IN_PROGRESS",resolved:"RESOLVED",closed:"REJECTED" } as any)[s]
;

const complaintOutput = async (complaint: any) => 
{
 const [profile] = await db.select().from(displacedPersonsTable).where(eq(displacedPersonsTable.userId,complaint.authorUserId))
;
 return profile ? map(complaintsTable)(
{
 ...complaint, displacedPersonId: profile.id 
}
) : undefined
;
 
}
;

router.get("/complaints",requireAuth,async(req,res):Promise<void>=>
{
const q=parse<any>(V.ListManagedComplaintsQueryParams,req.query,res)
;
if(!q)return
;
const where=req.authUser!.role==="MANAGER"?undefined:eq(complaintsTable.authorUserId,req.authUser!.id)
;
const rows=await db.select().from(complaintsTable).where(where).limit(q.limit).offset((q.page-1)*q.limit)
;
const items=await Promise.all(rows.map(complaintOutput))
;
if(items.some(i=>!i))
{
res.status(400).json(
{
error:"Complaint has no displaced-person profile"
}
)
;
return
;
}
const[
{
n
}
]=await db.select(
{
n:count()
}
).from(complaintsTable).where(where)
;
res.json(V.ListManagedComplaintsResponse.parse(
{
items,pagination:
{
page:q.page,limit:q.limit,totalItems:Number(n),totalPages:Math.ceil(Number(n)/q.limit)
}
}
))
;
}
)
;

router.post("/complaints",requireAuth,async(req,res):Promise<void>=>
{
const b=parse<any>(V.CreateComplaintBody,req.body,res)
;
if(!b)return
;
if(req.authUser!.role==="SECURITY")
{
res.status(403).json(
{
error:"Insufficient permissions"
}
)
;
return
;
}
let profile
;
 if(req.authUser!.role==="DISPLACED")
{
[profile]=await db.select().from(displacedPersonsTable).where(eq(displacedPersonsTable.userId,req.authUser!.id))
;
if(!profile||b.displacedPersonId!==undefined&&b.displacedPersonId!==profile.id)
{
res.status(403).json(
{
error:"Invalid displaced person"
}
)
;
return
;
}
}
else
{
if(b.displacedPersonId===undefined)
{
res.status(400).json(
{
error:"displacedPersonId is required"
}
)
;
return
;
}
[profile]=await db.select().from(displacedPersonsTable).where(eq(displacedPersonsTable.id,b.displacedPersonId))
;
if(!profile)
{
res.status(400).json(
{
error:"Displaced person not found"
}
)
;
return
;
}
if(req.authUser!.role==="DELEGATE"&&profile.delegateUserId!==req.authUser!.id)
{
res.status(403).json(
{
error:"Displaced person is not assigned to you"
}
)
;
return
;
}
}
const[c]=await db.insert(complaintsTable).values(
{
authorUserId:profile.userId,type:"GENERAL",subject:b.subject,body:b.message
}
).returning()
;
res.status(201).json(V.CreateComplaintResponse.parse(map(complaintsTable)(
{
...c,displacedPersonId:profile.id
}
)))
;
}
)
;

router.patch("/complaints/:id/status",manager,async(req,res):Promise<void>=>
{
const x=id(req,res,V.UpdateComplaintStatusParams),b=parse<any>(V.UpdateComplaintStatusBody,req.body,res)
;
if(x===undefined||!b)return
;
const[c]=await db.update(complaintsTable).set(
{
status:complaintStatus(b.status)
}
).where(eq(complaintsTable.id,x)).returning()
;
const out=c&&await complaintOutput(c)
;
if(!out)
{
res.status(404).json(
{
error:"Not found or complaint profile missing"
}
)
;
return
;
}
res.json(V.UpdateComplaintStatusResponse.parse(out))
;
}
)
;

router.post("/complaints/:id/reply",manager,async(req,res):Promise<void>=>
{
const x=id(req,res,V.ReplyToComplaintParams),b=parse<any>(V.ReplyToComplaintBody,req.body,res)
;
if(x===undefined||!b)return
;
const[c]=await db.update(complaintsTable).set(
{
reply:b.reply,repliedBy:req.authUser!.id,repliedAt:new Date()
}
).where(eq(complaintsTable.id,x)).returning()
;
const out=c&&await complaintOutput(c)
;
if(!out)
{
res.status(404).json(
{
error:"Not found or complaint profile missing"
}
)
;
return
;
}
res.json(V.ReplyToComplaintResponse.parse(out))
;
}
)
;


router.get("/notifications",requireAuth,async(req,res):Promise<void>=>
{
const q=parse<any>(V.ListNotificationsQueryParams,req.query,res)
;
if(!q)return
;
const where=eq(notificationsTable.recipientUserId,req.authUser!.id),rows=await db.select().from(notificationsTable).where(where).limit(q.limit).offset((q.page-1)*q.limit)
;
const[
{
n
}
]=await db.select(
{
n:count()
}
).from(notificationsTable).where(where)
;
res.json(V.ListNotificationsResponse.parse(
{
items:rows.map(map(notificationsTable)),pagination:
{
page:q.page,limit:q.limit,totalItems:Number(n),totalPages:Math.ceil(Number(n)/q.limit)
}
}
))
;
}
)
;

router.patch("/notifications/:id/read",requireAuth,async(req,res):Promise<void>=>
{
const x=id(req,res,V.MarkNotificationReadParams),b=parse<any>(V.MarkNotificationReadBody,req.body,res)
;
if(x===undefined||!b)return
;
const[n]=await db.update(notificationsTable).set(
{
readAt:b.read?new Date():null
}
).where(and(eq(notificationsTable.id,x),eq(notificationsTable.recipientUserId,req.authUser!.id))).returning()
;
if(!n)
{
res.status(404).json(
{
error:"Not found"
}
)
;
return
;
}
res.json(V.MarkNotificationReadResponse.parse(map(notificationsTable)(n)))
;
}
)
;


const taskStatus=(s:any)=>({ pending:"UPCOMING",inProgress:"IN_PROGRESS",completed:"COMPLETED" } as any)[s]
;

router.get("/security-tasks",requireRoles("manager","security"),async(req,res):Promise<void>=>
{
const q=parse<any>(V.ListSecurityTasksQueryParams,req.query,res)
;
if(!q)return
;
const where=req.authUser!.role==="MANAGER"?undefined:eq(securityTaskAssigneesTable.securityUserId,req.authUser!.id)
;
const rows=await db.select(
{
t:securityTasksTable,assignedToId:securityTaskAssigneesTable.securityUserId
}
).from(securityTasksTable).leftJoin(securityTaskAssigneesTable,eq(securityTasksTable.id,securityTaskAssigneesTable.taskId)).where(where).limit(q.limit).offset((q.page-1)*q.limit)
;
const[
{
n
}
]=await db.select(
{
n:count()
}
).from(securityTasksTable).leftJoin(securityTaskAssigneesTable,eq(securityTasksTable.id,securityTaskAssigneesTable.taskId)).where(where)
;
res.json(V.ListSecurityTasksResponse.parse(
{
items:rows.map(r=>map(securityTasksTable)(
{
...r.t,assignedToId:r.assignedToId
}
)),pagination:
{
page:q.page,limit:q.limit,totalItems:Number(n),totalPages:Math.ceil(Number(n)/q.limit)
}
}
))
;
}
)
;

router.post("/security-tasks",manager,async(req,res):Promise<void>=>
{
const b=parse<any>(V.CreateSecurityTaskBody,req.body,res)
;
if(!b)return
;
if(!b.dueAt)
{
res.status(400).json(
{
error:"dueAt is required by persistence model"
}
)
;
return
;
}
if(b.assignedToId)
{
const[u]=await db.select().from(usersTable).where(and(eq(usersTable.id,b.assignedToId),eq(usersTable.role,"SECURITY"),eq(usersTable.active,true)))
;
if(!u)
{
res.status(400).json(
{
error:"assignedToId must be an active security user"
}
)
;
return
;
}
}
const t=await db.transaction(async tx=>
{
const[t]=(await tx.insert(securityTasksTable).values(
{
title:b.title,body:b.description??"",dueAt:b.dueAt,createdBy:req.authUser!.id
}
).returning())
;
if(b.assignedToId)await tx.insert(securityTaskAssigneesTable).values(
{
taskId:t.id,securityUserId:b.assignedToId
}
)
;
return t
;
}
)
;
res.status(201).json(V.CreateSecurityTaskResponse.parse(
{
...map(securityTasksTable)(t),assignedToId:b.assignedToId??null
}
))
;
}
)
;

router.patch("/security-tasks/:id",requireRoles("manager","security"),async(req,res):Promise<void>=>
{
const x=id(req,res,V.UpdateSecurityTaskParams),b=parse<any>(V.UpdateSecurityTaskBody,req.body,res)
;
if(x===undefined||!b)return
;
if(req.authUser!.role==="SECURITY"&&(b.title!==undefined||b.description!==undefined||b.dueAt!==undefined||b.assignedToId!==undefined))
{
res.status(403).json(
{
error:"Security users may update task status only"
}
)
;
return
;
}
const visible=req.authUser!.role==="MANAGER"?eq(securityTasksTable.id,x):and(eq(securityTasksTable.id,x),inArray(securityTasksTable.id,db.select(
{
id:securityTaskAssigneesTable.taskId
}
).from(securityTaskAssigneesTable).where(eq(securityTaskAssigneesTable.securityUserId,req.authUser!.id))))
;
if(b.assignedToId!==undefined&&b.assignedToId!==null)
{
const[u]=await db.select().from(usersTable).where(and(eq(usersTable.id,b.assignedToId),eq(usersTable.role,"SECURITY"),eq(usersTable.active,true)))
;
if(!u)
{
res.status(400).json(
{
error:"assignedToId must be an active security user"
}
)
;
return
;
}
}
const t=await db.transaction(async tx=>
{
const[t]=await tx.update(securityTasksTable).set(
{
title:b.title,body:b.description,status:b.status?taskStatus(b.status):undefined,dueAt:b.dueAt
}
).where(visible).returning()
;
if(t&&b.assignedToId!==undefined)
{
await tx.delete(securityTaskAssigneesTable).where(eq(securityTaskAssigneesTable.taskId,x))
;
if(b.assignedToId!==null)await tx.insert(securityTaskAssigneesTable).values(
{
taskId:x,securityUserId:b.assignedToId
}
)
;
}
return t
;
}
)
;
if(!t)
{
res.status(404).json(
{
error:"Not found"
}
)
;
return
;
}
const[a]=await db.select().from(securityTaskAssigneesTable).where(eq(securityTaskAssigneesTable.taskId,x))
;
res.json(V.UpdateSecurityTaskResponse.parse(
{
...map(securityTasksTable)(t),assignedToId:a?.securityUserId??null
}
))
;
}
)
;


router.get("/content",async(req,res):Promise<void>=>
{
const q=parse<any>(V.ListContentQueryParams,req.query,res)
;
if(!q)return
;
const canDraft=req.authUser?.role==="MANAGER",where=canDraft?undefined:eq(contentPostsTable.status,"PUBLISHED")
;
const rows=await db.select().from(contentPostsTable).where(where).limit(q.limit).offset((q.page-1)*q.limit)
;
const media=rows.length?await db.select().from(mediaReferencesTable).where(and(eq(mediaReferencesTable.ownerType,"content_post"),inArray(mediaReferencesTable.ownerId,rows.map(p=>p.id)))):[]
;
const images=new Map(media.map(m=>[m.ownerId,m.publicUrl]))
;
const[
{
n
}
]=await db.select(
{
n:count()
}
).from(contentPostsTable).where(where)
;
res.json(V.ListContentResponse.parse(
{
items:rows.map(p=>(
{
...map(contentPostsTable)(p),imageUrl:images.get(p.id)??null
}
)),pagination:
{
page:q.page,limit:q.limit,totalItems:Number(n),totalPages:Math.ceil(Number(n)/q.limit)
}
}
))
;
}
)
;

router.post("/content",manager,async(req,res):Promise<void>=>
{
const b=parse<any>(V.CreateContentPostBody,req.body,res)
;
if(!b)return
;
const published=b.status==="published"
;
const[p]=await db.insert(contentPostsTable).values(
{
title:b.title,body:b.body,type:"BLOG",status:published?"PUBLISHED":"DRAFT",authorUserId:req.authUser!.id,publishedAt:published?new Date():null
}
).returning()
;
if(b.imageUrl)await db.insert(mediaReferencesTable).values(
{
ownerType:"content_post",ownerId:p.id,objectPath:b.imageUrl,publicUrl:b.imageUrl
}
)
;
res.status(201).json(V.CreateContentPostResponse.parse(
{
...map(contentPostsTable)(p),imageUrl:b.imageUrl??null
}
))
;
}
)
;

router.get("/content/:id",async(req,res):Promise<void>=>
{
const x=id(req,res,V.GetContentPostParams)
;
if(x===undefined)return
;
const[p]=await db.select().from(contentPostsTable).where(eq(contentPostsTable.id,x))
;
if(!p||(p.status!=="PUBLISHED"&&req.authUser?.role!=="MANAGER"))
{
res.status(404).json(
{
error:"Not found"
}
)
;
return
;
}
const[m]=await db.select().from(mediaReferencesTable).where(and(eq(mediaReferencesTable.ownerType,"content_post"),eq(mediaReferencesTable.ownerId,x)))
;
res.json(V.GetContentPostResponse.parse(
{
...map(contentPostsTable)(p),imageUrl:m?.publicUrl??null
}
))
;
}
)
;

router.patch("/content/:id",manager,async(req,res):Promise<void>=>
{
const x=id(req,res,V.UpdateContentPostParams),b=parse<any>(V.UpdateContentPostBody,req.body,res)
;
if(x===undefined||!b)return
;
const published=b.status==="published"
;
const[p]=await db.update(contentPostsTable).set(
{
title:b.title,body:b.body,status:b.status?(published?"PUBLISHED":"DRAFT"):undefined,publishedAt:published?new Date():undefined
}
).where(eq(contentPostsTable.id,x)).returning()
;
if(!p)
{
res.status(404).json(
{
error:"Not found"
}
)
;
return
;
}
if(b.imageUrl!==undefined)
{
await db.delete(mediaReferencesTable).where(and(eq(mediaReferencesTable.ownerType,"content_post"),eq(mediaReferencesTable.ownerId,x)))
;
if(b.imageUrl)await db.insert(mediaReferencesTable).values(
{
ownerType:"content_post",ownerId:x,objectPath:b.imageUrl,publicUrl:b.imageUrl
}
)
;
}
const[m]=b.imageUrl===undefined?await db.select().from(mediaReferencesTable).where(and(eq(mediaReferencesTable.ownerType,"content_post"),eq(mediaReferencesTable.ownerId,x))):[]
;
res.json(V.UpdateContentPostResponse.parse(
{
...map(contentPostsTable)(p),imageUrl:b.imageUrl===undefined?m?.publicUrl??null:b.imageUrl
}
))
;
}
)
;

router.post("/contact-requests",async(req,res):Promise<void>=>
{
const b=parse<any>(V.CreateContactRequestBody,req.body,res)
;
if(!b)return
;
const[c]=await db.insert(contactRequestsTable).values(
{
name:b.name,email:b.email,phoneNumber:b.phone,message:b.message
}
).returning()
;
res.status(201).json(V.CreateContactRequestResponse.parse(
{
...c,phone:c.phoneNumber
}
))
;
}
)
;


export default router
;
