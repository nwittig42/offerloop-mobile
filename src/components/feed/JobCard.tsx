import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import Chip from '@/components/ui/Chip';
import { colors, fonts } from '@/theme/tokens';
import type { Job } from '@/types';

/**
 * The swipe card body, also reused by the expanded job detail screen.
 * Chip groups render only when the underlying field exists, never as
 * placeholders: no data, no chip.
 */
export function JobCard({ job, expanded = false }: { job: Job; expanded?: boolean }) {
  return (
    <View style={{ gap: 14 }}>
      <Text
        numberOfLines={expanded ? undefined : 2}
        style={{ fontFamily: fonts.sansSemibold, fontSize: 22, color: colors.heading }}>
        {job.title}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            backgroundColor: colors.paper2,
            borderWidth: 1,
            borderColor: colors.hairline,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.navy }}>
            {job.company.charAt(0)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink }}>
            {job.company}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="location-outline" size={11} color={colors.inkTertiary} />
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
              {job.location}
            </Text>
          </View>
        </View>
      </View>

      {job.workArrangement || job.experienceLevel ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {job.workArrangement ? <Chip label={job.workArrangement} tone="brand" /> : null}
          {job.experienceLevel ? <Chip label={job.experienceLevel} tone="accent" /> : null}
          {job.education ? <Chip label={job.education} /> : null}
        </View>
      ) : null}

      <View style={{ gap: 5 }}>
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: colors.inkSecondary }}>
          Job description
        </Text>
        <Text
          numberOfLines={expanded ? undefined : 4}
          style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 20 }}>
          {job.description}
        </Text>
        {!expanded ? (
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.accent }}>
            Tap to read more
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default JobCard;
