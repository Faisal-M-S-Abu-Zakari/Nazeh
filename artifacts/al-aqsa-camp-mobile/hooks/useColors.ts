import { useColorScheme } from 'react-native';
import colors from '@/constants/colors';

export function useColors() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { ...colors[scheme], radius: colors.radius };
}