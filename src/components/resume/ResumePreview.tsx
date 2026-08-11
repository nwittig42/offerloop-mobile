import { Image, ScrollView, Text, View, type ImageSourcePropType } from 'react-native';

import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme/ThemeProvider';
import { fonts, shadows } from '@/theme/tokens';

/**
 * The approval step for a generated (or freshly uploaded) resume. Hard product
 * rule: nothing uses a resume the user has not explicitly approved, so this
 * screen is deliberately calm and legible, their name goes on real
 * applications. A document look (page thumbnail, titled sections), one clear
 * primary action, a quiet way out.
 *
 * Standalone: Session A supplies the thumbnail and parsed sections and wires
 * both buttons. No data fetching, no navigation.
 */

/**
 * One entry inside a section, shaped to take CanonicalResume content directly:
 * an experience maps heading=role, sub=org, meta=dates, bullets=bullets; a
 * skills section can be a single entry with only bullets. Everything optional
 * so thin data renders honestly instead of with placeholder rows.
 */
export type ResumePreviewEntry = {
  heading?: string;
  sub?: string;
  meta?: string;
  bullets?: string[];
};

export type ResumePreviewSection = {
  title: string;
  entries: ResumePreviewEntry[];
};

export function ResumePreview({
  thumbnail,
  fileName,
  sections,
  onUse,
  useLabel = 'Use this resume',
  onSecondary,
  secondaryLabel = 'Edit in profile',
  busy = false,
}: {
  /** Rendered page image of the resume, when one exists. */
  thumbnail?: ImageSourcePropType;
  fileName?: string;
  /** Parsed content, shown as titled sections under the page. */
  sections: ResumePreviewSection[];
  onUse: () => void;
  /** Override the primary button label (the edit screen says "Save changes"). */
  useLabel?: string;
  onSecondary?: () => void;
  secondaryLabel?: string;
  busy?: boolean;
}) {
  const colors = useColors();

  return (
    <View style={{ flex: 1, gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.heading }}>
          Here is your resume
        </Text>
        <Text
          style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 19 }}>
          Read it over. It only goes on applications after you approve it.
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}>
        {thumbnail ? (
          <View style={{ alignItems: 'center' }}>
            <Image
              source={thumbnail}
              resizeMode="contain"
              accessibilityLabel={fileName ? `Preview of ${fileName}` : 'Resume preview'}
              style={{
                width: '82%',
                aspectRatio: 8.5 / 11,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: colors.hairline,
                backgroundColor: colors.paper,
                ...shadows.md,
              }}
            />
            {fileName ? (
              <Text
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 11.5,
                  color: colors.inkTertiary,
                  marginTop: 8,
                }}>
                {fileName}
              </Text>
            ) : null}
          </View>
        ) : null}

        {sections.map((s) => (
          <View
            key={s.title}
            style={{
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.hairlineLight,
              backgroundColor: colors.paper,
              padding: 16,
              gap: 8,
            }}>
            <Text
              style={{
                fontFamily: fonts.sansSemibold,
                fontSize: 12,
                color: colors.inkTertiary,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
              }}>
              {s.title}
            </Text>
            {s.entries.map((e, i) => (
              <View key={i} style={{ gap: 4, marginTop: i > 0 ? 6 : 0 }}>
                {e.heading || e.meta ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    {e.heading ? (
                      <Text
                        style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink, flex: 1 }}>
                        {e.heading}
                      </Text>
                    ) : null}
                    {e.meta ? (
                      <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
                        {e.meta}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {e.sub ? (
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.accent }}>
                    {e.sub}
                  </Text>
                ) : null}
                {(e.bullets ?? []).map((b, j) => (
                  <View key={j} style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={{ color: colors.inkTertiary, fontSize: 13 }}>•</Text>
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: fonts.sans,
                        fontSize: 13,
                        color: colors.inkSecondary,
                        lineHeight: 19,
                      }}>
                      {b}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={{ gap: 8 }}>
        <Button
          label={busy ? 'Saving' : useLabel}
          variant="brand"
          size="lg"
          fullWidth
          disabled={busy}
          onPress={onUse}
        />
        {onSecondary ? (
          <Button label={secondaryLabel} variant="ghost" fullWidth onPress={onSecondary} />
        ) : null}
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 11.5,
            color: colors.inkTertiary,
            textAlign: 'center',
            lineHeight: 16,
          }}>
          You can replace or edit this any time from your profile.
        </Text>
      </View>
    </View>
  );
}

export default ResumePreview;
