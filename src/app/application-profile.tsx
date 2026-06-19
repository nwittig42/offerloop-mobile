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
 * Application Profile: the answers auto-apply reuses on every job so it rarely
 * stops to ask. The backend gate only requires work authorization, but the more
 * of this that's filled, the fewer "Needs your input" stalls — relocation,
 * remote, start date, salary, and the EEO questions show up on nearly every
 * Greenhouse / Lever / Ashby form. Reached from Profile or a needs-profile gate.
 */

const DECLINE = 'Decline to answer';
const GENDERS = ['Male', 'Female', 'Non-binary', DECLINE];
const RACES = [
  'Asian',
  'Black or African American',
  'Hispanic or Latino',
  'White',
  'Native American',
  'Pacific Islander',
  'Two or more races',
  DECLINE,
];
const VETERAN = ['Not a veteran', 'Protected veteran', DECLINE];
const DISABILITY = ['No', 'Yes', DECLINE];

function SectionLabel({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12, letterSpacing: 0.4, color: colors.inkTertiary, marginTop: 4 }}>
      {children}
    </Text>
  );
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
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

function Choice({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = value === o;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderWidth: on ? 1.5 : 1,
              borderColor: on ? colors.accent : colors.hairline,
              backgroundColor: on ? colors.accent + '12' : colors.paper,
            }}>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: on ? colors.accent : colors.ink }}>
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>{label}</Text>
      {children}
    </View>
  );
}

export default function ApplicationProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const qc = useQueryClient();
  const { showToast, profile } = useApp();

  const { data, isLoading } = useQuery({
    queryKey: ['applicationProfile'],
    queryFn: getApplicationProfile,
  });

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [sponsorship, setSponsorship] = useState<boolean | null>(null);
  const [relocate, setRelocate] = useState<boolean | null>(null);
  const [remote, setRemote] = useState<boolean | null>(null);
  const [startDate, setStartDate] = useState('');
  const [salary, setSalary] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [race, setRace] = useState<string | null>(null);
  const [veteran, setVeteran] = useState<string | null>(null);
  const [disability, setDisability] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [linkedin, setLinkedin] = useState('');

  // Hydrate from the saved profile, falling back to what we already know from
  // the user's Offerloop profile (LinkedIn + phone). Saved values win.
  useEffect(() => {
    if (!data) return;
    setAuthorized(data.workAuthorization?.authorizedToWorkUS ?? null);
    setSponsorship(data.workAuthorization?.requiresSponsorship ?? null);
    setRelocate(data.preferences?.openToRelocation ?? null);
    setRemote(data.preferences?.openToRemote ?? null);
    setStartDate(data.preferences?.earliestStartDate ?? '');
    setSalary(data.preferences?.expectedSalaryUsd != null ? String(data.preferences.expectedSalaryUsd) : '');
    setGender(data.demographics?.gender ?? null);
    setRace(data.demographics?.race ?? null);
    setVeteran(data.veteranStatus ?? null);
    setDisability(data.disabilityStatus ?? null);
    setPhone(data.contactInfo?.phone || profile.phone || '');
    setLinkedin(data.contactInfo?.linkedinUrl || profile.linkedinUrl || '');
  }, [data, profile.phone, profile.linkedinUrl]);

  const save = useMutation({
    mutationFn: () => {
      const salaryNum = parseInt(salary.replace(/[^0-9]/g, ''), 10);
      const patch: ApplicationProfile = {
        workAuthorization: { authorizedToWorkUS: authorized, requiresSponsorship: sponsorship },
        preferences: {
          openToRelocation: relocate,
          openToRemote: remote,
          earliestStartDate: startDate.trim() || null,
          expectedSalaryUsd: Number.isFinite(salaryNum) && salaryNum > 0 ? salaryNum : null,
        },
        demographics: { gender, race },
        veteranStatus: veteran,
        disabilityStatus: disability,
        contactInfo: { phone: phone.trim() || null, linkedinUrl: linkedin.trim() || null },
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

  const canSave = authorized !== null && !save.isPending;

  const inputStyle = {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 2,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          paddingTop: insets.top + 12,
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
          Auto-apply reuses these on every application. Only work authorization is required, but the
          more you fill in, the fewer times it has to stop and ask you mid-application.
        </Text>

        <SectionLabel>WORK AUTHORIZATION</SectionLabel>
        <Card style={{ gap: 14 }}>
          <Field label="Are you authorized to work in the US?">
            <YesNo value={authorized} onChange={setAuthorized} />
          </Field>
          <Field label="Will you now or in the future need sponsorship?">
            <YesNo value={sponsorship} onChange={setSponsorship} />
          </Field>
        </Card>

        <SectionLabel>JOB PREFERENCES</SectionLabel>
        <Card style={{ gap: 14 }}>
          <Field label="Open to relocation?">
            <YesNo value={relocate} onChange={setRelocate} />
          </Field>
          <Field label="Open to remote?">
            <YesNo value={remote} onChange={setRemote} />
          </Field>
          <Field label="Earliest start date">
            <TextInput
              value={startDate}
              onChangeText={setStartDate}
              placeholder="e.g. Immediately, or June 2027"
              placeholderTextColor={colors.inkTertiary}
              style={inputStyle}
            />
          </Field>
          <Field label="Expected salary (USD)">
            <TextInput
              value={salary}
              onChangeText={setSalary}
              placeholder="e.g. 85000"
              placeholderTextColor={colors.inkTertiary}
              keyboardType="number-pad"
              style={inputStyle}
            />
          </Field>
        </Card>

        <SectionLabel>CONTACT</SectionLabel>
        <Card style={{ gap: 14 }}>
          <Field label="Phone">
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="(555) 123-4567"
              placeholderTextColor={colors.inkTertiary}
              keyboardType="phone-pad"
              style={inputStyle}
            />
          </Field>
          <Field label="LinkedIn URL">
            <TextInput
              value={linkedin}
              onChangeText={setLinkedin}
              placeholder="linkedin.com/in/you"
              placeholderTextColor={colors.inkTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              style={inputStyle}
            />
          </Field>
        </Card>

        <SectionLabel>VOLUNTARY EEO (OPTIONAL)</SectionLabel>
        <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary, lineHeight: 16, marginTop: -8 }}>
          Used only to answer the demographic questions employers ask. Defaults to “Decline” if left
          blank.
        </Text>
        <Card style={{ gap: 14 }}>
          <Field label="Gender">
            <Choice options={GENDERS} value={gender} onChange={setGender} />
          </Field>
          <Field label="Race / ethnicity">
            <Choice options={RACES} value={race} onChange={setRace} />
          </Field>
          <Field label="Veteran status">
            <Choice options={VETERAN} value={veteran} onChange={setVeteran} />
          </Field>
          <Field label="Disability status">
            <Choice options={DISABILITY} value={disability} onChange={setDisability} />
          </Field>
        </Card>

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
            Saving acknowledges that Offerloop will submit job applications on your behalf using these
            answers and your resume.
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
