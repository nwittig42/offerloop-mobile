import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getApplicationProfile,
  saveApplicationProfile,
  type ApplicationProfile,
} from '@/api/endpoints/autoApply';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Application Profile: the one-time setup auto-apply needs before it can submit
 * anything. The backend gate only requires work authorization + an
 * acknowledgment (saving stamps it). Phone / LinkedIn are optional fills that
 * resume parsers usually miss. Reached from swipe settings or when a prepare
 * returns PROFILE_REQUIRED.
 */

/** A yes / no / unanswered control — null stays "Choose" rather than implying a value. */
function YesNo({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  const colors = useColors();
  const opt = (label: string, on: boolean, pick: () => void) => (
    <Pressable
      onPress={pick}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: on ? 1.5 : 1,
        borderColor: on ? colors.accent : colors.hairline,
        backgroundColor: on ? colors.accent + '12' : colors.paper,
        alignItems: 'center',
      }}>
      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: on ? colors.accent : colors.ink }}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {opt('Yes', value === true, () => onChange(true))}
      {opt('No', value === false, () => onChange(false))}
    </View>
  );
}

export default function ApplicationProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const qc = useQueryClient();
  const { showToast } = useApp();

  const { data, isLoading } = useQuery({
    queryKey: ['applicationProfile'],
    queryFn: getApplicationProfile,
  });

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [sponsorship, setSponsorship] = useState<boolean | null>(null);
  const [phone, setPhone] = useState('');
  const [linkedin, setLinkedin] = useState('');

  // Hydrate the form once the stored profile loads.
  useEffect(() => {
    if (!data) return;
    setAuthorized(data.workAuthorization?.authorizedToWorkUS ?? null);
    setSponsorship(data.workAuthorization?.requiresSponsorship ?? null);
    setPhone(data.contactInfo?.phone ?? '');
    setLinkedin(data.contactInfo?.linkedinUrl ?? '');
  }, [data]);

  const save = useMutation({
    mutationFn: () => {
      const patch: ApplicationProfile = {
        workAuthorization: {
          authorizedToWorkUS: authorized,
          requiresSponsorship: sponsorship,
        },
        contactInfo: {
          phone: phone.trim() || null,
          linkedinUrl: linkedin.trim() || null,
        },
      };
      return saveApplicationProfile(patch);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applicationProfile'] });
      showToast('Application profile saved');
      router.back();
    },
    onError: () => showToast('Could not save, try again'),
  });

  // Work authorization is the only hard requirement the backend gate enforces.
  const canSave = authorized !== null && !save.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          paddingTop: 18,
          paddingHorizontal: 20,
          paddingBottom: 12,
          backgroundColor: colors.paper,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 26, color: colors.heading }}>
          Application profile
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: insets.bottom + 32 }}>
        <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 20 }}>
          Auto-apply fills these answers on every application so you never retype them. Work
          authorization is required; the rest is optional and only used to fill fields your
          resume misses.
        </Text>

        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
            Are you authorized to work in the US?
          </Text>
          <Card style={{ gap: 4 }}>
            <YesNo value={authorized} onChange={setAuthorized} />
          </Card>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
            Will you now or in the future need sponsorship?
          </Text>
          <Card style={{ gap: 4 }}>
            <YesNo value={sponsorship} onChange={setSponsorship} />
          </Card>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
            Phone <Text style={{ color: colors.inkTertiary }}>(optional)</Text>
          </Text>
          <Card>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="(555) 123-4567"
              placeholderTextColor={colors.inkTertiary}
              keyboardType="phone-pad"
              style={{ fontFamily: fonts.sans, fontSize: 15, color: colors.ink, paddingVertical: 2 }}
            />
          </Card>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
            LinkedIn URL <Text style={{ color: colors.inkTertiary }}>(optional)</Text>
          </Text>
          <Card>
            <TextInput
              value={linkedin}
              onChangeText={setLinkedin}
              placeholder="linkedin.com/in/you"
              placeholderTextColor={colors.inkTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ fontFamily: fonts.sans, fontSize: 15, color: colors.ink, paddingVertical: 2 }}
            />
          </Card>
        </View>

        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            padding: 12,
            borderRadius: 10,
            backgroundColor: colors.navy + '0D',
          }}>
          <Ionicons name="information-circle-outline" size={18} color={colors.navy} />
          <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.inkSecondary, lineHeight: 18 }}>
            Saving acknowledges that Offerloop will submit job applications on your behalf using
            these answers and your resume. You review each one before it sends.
          </Text>
        </View>

        <Button
          label={save.isPending ? 'Saving…' : 'Save profile'}
          onPress={() => save.mutate()}
          disabled={!canSave || isLoading}
        />
      </ScrollView>
    </View>
  );
}
