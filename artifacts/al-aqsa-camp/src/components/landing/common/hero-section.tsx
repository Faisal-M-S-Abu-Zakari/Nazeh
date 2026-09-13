'use client';
import { Carousel } from '@mantine/carousel';
import { Box, Flex, Overlay, Text, Title } from '@mantine/core';
import { Image } from '@/lib/nextjs-mocks';
import { useRef, useState } from 'react';
import Autoplay from 'embla-carousel-autoplay';
import { HOME_HERO_SLIDER_1, HOME_HERO_SLIDER_2, HOME_HERO_SLIDER_3 } from '@/assets/landing/home';
import {
  BLOG_HERO_CONTENT,
  DESTINATION_HERO_SECTION,
  HOME_HERO_CONTENT,
  SUCCESS_STORIES_HERO_CONTENT,
} from '@/content/landing';

interface Props {
  destination: DESTINATION_HERO_SECTION;
}
export default function Hero_Section({ destination }: Props) {
  const content =
    destination == DESTINATION_HERO_SECTION.HOME
      ? HOME_HERO_CONTENT
      : destination == DESTINATION_HERO_SECTION.BLOG
      ? BLOG_HERO_CONTENT
      : SUCCESS_STORIES_HERO_CONTENT;

  const autoplay = useRef(Autoplay({ delay: 5000, stopOnInteraction: false }));
  const [activeSlide, setActiveSlide] = useState(0);

  const slides = content.map((item, index) => (
    <Carousel.Slide key={item.title} w='100%' h='100%'>
      <Box h='100%' style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <Image
          alt={item.title}
          src={item.image}
          fill
          priority={index === 0}
          className='block h-full w-full object-cover'
        />
      </Box>
    </Carousel.Slide>
  ));

  return (
    <Box pos='relative' w='100%' h={{ base: 350, md: 400 }}>
      <Carousel
        w='100%'
        h='100%'
        withControls={false}
        withIndicators
        slideSize='100%'
        classNames={{
          root: 'h-full',
          viewport: 'h-full',
          container: 'h-full',
          slide: 'h-full',
        }}
        styles={{
          root: { height: '100%' },
          viewport: { height: '100%' },
          container: { height: '100%' },
          slide: { height: '100%' },
          indicators: { bottom: 18, zIndex: 20 },
          indicator: {
            width: 9,
            height: 9,
            border: '1px solid rgba(255,255,255,.8)',
            backgroundColor: 'rgba(255,255,255,.55)',
          },
        }}
        emblaOptions={{
          loop: true,
          align: 'start',
          slidesToScroll: 1,
        }}
        plugins={[autoplay.current]}
        onMouseEnter={autoplay.current.stop}
        onMouseLeave={autoplay.current.reset}
        onSlideChange={setActiveSlide}
      >
        {slides}
      </Carousel>
      <Overlay
        gradient='linear-gradient(180deg, rgba(0,0,0,.18) 0%, rgba(0,0,0,.35) 45%, rgba(0,0,0,.78) 100%)'
        zIndex={0}
      />
      <Flex
        direction='column'
        justify='center'
        align='start'
        pos='absolute'
        bottom={{ base: 48, md: 54 }}
        right={{ base: '5%', md: '8%', lg: '10%' }}
        left={{ base: '5%', md: '8%', lg: '10%' }}
        className='!z-10 transition-all duration-500'
        dir='rtl'
      >
        <Title order={1} fw={{ base: 700, md: 800 }} fz={{ base: 27, md: 38 }} c='white' ta='right'>
          {content[activeSlide]?.title}
        </Title>
        <Text
          fz={{ base: 15, md: 20, lg: 23 }}
          c='gray.1'
          ta='right'
          mt={{ base: 8, md: 14 }}
          maw={820}
          className='leading-relaxed drop-shadow-sm'
          style={{ whiteSpace: 'pre-line' }}
        >
          {content[activeSlide]?.desc}
        </Text>
      </Flex>
    </Box>
  );
}
