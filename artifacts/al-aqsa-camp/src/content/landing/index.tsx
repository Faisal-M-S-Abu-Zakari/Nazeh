import { BLOG_HERO_SLIDER_1, BLOG_HERO_SLIDER_2, BLOG_HERO_SLIDER_3 } from '@/assets/landing/blog';
import { HOME_HERO_SLIDER_1, HOME_HERO_SLIDER_2, HOME_HERO_SLIDER_3 } from '@/assets/landing/home';
import {
  SUCCESS_STORY_HERO_SLIDER_1,
  SUCCESS_STORY_HERO_SLIDER_2,
  SUCCESS_STORY_HERO_SLIDER_3,
} from '@/assets/landing/success-story';
import {
  Smile,
  Users,
  BookOpenText,
  Brain,
  Rss,
  ShieldPlus,
  Tent,
  Hospital,
  HeartPlus,
  Apple,
} from 'lucide-react';

export enum DESTINATION_HERO_SECTION {
  HOME = 'HOME',
  BLOG = 'BLOG',
  SUCCESS_STORIES = 'SUCCESS_STORIES',
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////
// HOME PAGE:
////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const HOME_HERO_CONTENT = [
  {
    title: 'رسالتُنا :',
    desc: 'نسعى لخلق الحياة لأناسٍ سُلبت منهم الحياة ، طفولة بريئة و عيون تبحث عن الأمل',
    image: HOME_HERO_SLIDER_1,
  },
  {
    title: 'من نحن ؟',
    desc: 'منصة إدارة المخيمات الإنسانية هي منظومة مستقلة لخدمة فرق الإغاثة وإدارة الأسر والاحتياجات والمساعدات في المخيمات بكفاءة وكرامة.',
    image: HOME_HERO_SLIDER_2,
  },
  {
    title: 'هدفنا :',
    desc: 'نسعى لتقديم المساعدات الإنسانية للنازحين المتضررين في قطاع غزة و تقديم يد العون لهم من خلال تخفيف العبء اليومي عليهم و تسهيل أوضاعهم الحياتية، و توفير مجموعة متنوعة من المساعدات الإنسانية',
    image: HOME_HERO_SLIDER_3,
  },
];

// STATISTICS
export const HOME_STATISTICS_TITLE = 'رغم التحديات إلا أننا مستمرون لنصنع فارق';
export const HOME_STATISTICS_MESSAGE =
  ' اليوم، نعمل على تقديم مساعدات منقذة للحياة لألاف الأشخاص الذين يعيشون على حافة البقاء على قيد الحياة';

export const HOME_STATISTICS_DATA = [
  { icon: Tent, value: 5200, label: 'خيم' },
  { icon: Smile, value: 5200, label: 'طفل' },
  { icon: Users, value: 42300, label: 'عائلة' },
  { icon: Hospital, value: 1200, label: 'مصابين' },
];

// SERVICES
export const HOME_SERVICES_TITLE = 'الإغاثة والخدمات الأساسية';
export const HOME_SERVICES_Data = [
  {
    icon: Tent, // Placeholder name, replace with actual icon component/path
    title: 'المأوى',
    description: 'يوفر المخيم حياة ومساحات آمنة للعائلات النازحة لضمان الحماية والخصوصية.',
  },
  {
    icon: Apple,
    title: 'الغذاء والمياه',
    description: 'تقديم وجبات غذائية متكاملة ومياه نظيفة لضمان صحة النازحين واحتياجاتهم الأساسية.',
  },
  {
    icon: Hospital,
    title: 'الرعاية الصحية',
    description: 'تقديم خدمات طبية وعلاجات مجانية لضمان صحة النازحين ووقايتهم من الأمراض.',
  },
  {
    icon: HeartPlus,
    title: 'الدعم النفسي والاجتماعي',
    description:
      'توفير برامج دعم نفسي وأنشطة ترفيهية للأطفال والكبار للمساعدة في التكيف مع الظروف الصعبة.',
  },
  {
    icon: BookOpenText,
    title: 'التعليم',
    description:
      'إنشاء مدارس مؤقتة وبرامج تعليمية للأطفال والشباب وتوفير فرص لتعلم مهارات جديدة تساعدهم على تحقيق الذات في المستقبل.',
  },
  {
    icon: Rss,
    title: 'خدمات الإنترنت والتكنولوجيا',
    description:
      'توفير نقاط إنترنت منخفضة التكلفة داخل المخيم لدعم الطلبة على استمرار مسيرتهم التعليمية.',
  },
  {
    icon: ShieldPlus,
    title: 'خدمات الإسعافات الأولية والطوارئ',
    description:
      'تدريب السكان على الإسعافات الأولية، وتوفير حقائب طوارئ تحتوي على أدوات أساسية مثل الضمادات والأدوية.',
  },
  {
    icon: Brain,
    title: 'برامج التوعية والتثقيف الصحي',
    description: 'تنظيم جلسات توعية حول الصحة العامة، النظافة الشخصية، والتغذية السليمة.',
  },
];

////////////////////////////////////////////////////////////////////////////////////////////////////////////
// BLOG PAGE:
////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const BLOG_HERO_CONTENT = [
  {
    title: 'رسالتنا :',
    desc: 'نحول الأمل إلى واقع بإنسانية وشفافية، لبناء مجتمع نابض بالحياة.',
    image: BLOG_HERO_SLIDER_1,
  },
  {
    title: 'مدونتنا :',
    desc: 'نطلعكم دائماً على النشاطات وقصص الصمود والإنجازات في المخيمات الإنسانية.',
    image: BLOG_HERO_SLIDER_2,
  },
  {
    title: 'كونوا جزءًا منا :',
    desc: 'اقرأوا مدونتنا، وانضموا لنشر الأمل والتغيير في مجتمعنا.',
    image: BLOG_HERO_SLIDER_3,
  },
];

export const BLOG_TITLE = 'مدونتنا :';

export const BLOG_TITLE_ANOTHER = 'مقالات أخرى :';

////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SUCCESS STORIES PAGE:
////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const SUCCESS_STORIES_HERO_CONTENT = [
  {
    title: 'قصص نجاحنا :',
    desc: 'بتكاتف تطوعي، تحول اليأس إلى أمل، ونبني مجتمعًا مستدامًا نابضًا بالحياة.',
    image: SUCCESS_STORY_HERO_SLIDER_1,
  },
  {
    title: 'حكايات أبطالنا :',
    desc: 'في كل خيمة يسكن الألم، لكن العزيمة لا تعرف الاستسلام.',
    image: SUCCESS_STORY_HERO_SLIDER_2,
  },
  {
    title: 'كُن جزءًا من النجاح :',
    desc: 'شارك في دعم قصصنا، اكتشف قصصًا ملهمة تعكس قوة الإرادة وساهم في مستقبل مشرق.',
    image: SUCCESS_STORY_HERO_SLIDER_3,
  },
];

export const SUCCESS_STORIES_TITLE = 'قصص نجاحنا:';
