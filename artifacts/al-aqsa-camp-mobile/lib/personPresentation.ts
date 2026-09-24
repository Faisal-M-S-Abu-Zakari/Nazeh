import type { Person as ApiPerson } from '@workspace/api-client-react';

export function selectLatestPeople(
  apiPeople: ApiPerson[] | undefined,
  cachedPeople: ApiPerson[],
): ApiPerson[] {
  if (!apiPeople) return cachedPeople;

  const cachedById = new Map(cachedPeople.map((person) => [person.id, person]));
  return apiPeople.map((person) => {
    const cachedPerson = cachedById.get(person.id);
    return cachedPerson && cachedPerson.version > person.version
      ? cachedPerson
      : person;
  });
}
