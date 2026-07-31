import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createSavedTemplate,
  deleteSavedTemplate,
  fetchEmailTemplate,
  fetchSavedTemplates,
  saveEmailTemplate,
  type SavedTemplate,
} from '@/api/endpoints/emailTemplate';
import { qk } from '@/api/queryKeys';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Input from '@/components/ui/Input';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Outreach template: the app-side mirror of the web's Email Template page.
 * Pick what your emails ask for (or, on Elite, describe your own template in
 * plain English), set the sign-off, and every drafted email follows it. The
 * backend reads the saved default when the swipe pipeline drafts, so this
 * screen needs no extra wiring to take effect.
 */

const MAX_INSTRUCTIONS = 4000;

type PurposeKey = 'networking' | 'referral' | 'follow_up';
const CUSTOM = 'custom';

const PURPOSES: { key: PurposeKey; label: string; sub: string }[] = [
  {
    key: 'networking',
    label: 'Networking',
    sub: 'Ask for a coffee chat to learn about their role and company. The default.',
  },
  {
    key: 'referral',
    label: 'Referral request',
    sub: 'Ask to be referred for a specific opening at their company.',
  },
  {
    key: 'follow_up',
    label: 'Follow-up',
    sub: 'Nudge a thread that has not gotten a reply yet.',
  },
];

const SIGNOFFS = ['Best,', 'Thanks,', 'Warm regards,', 'Sincerely,', 'Cheers,'];

/** Sample bodies (same copy as the web page), personalized with the user's
 *  first name. Clearly labeled a preview; real drafts are personalized per
 *  contact. */
function previewBody(purpose: PurposeKey, firstName: string): string {
  const f = firstName || 'Deena';
  switch (purpose) {
    case 'networking':
      return `Hi Alex,\n\nMy name is ${f}, and I'm a junior studying Computer Science at USC. I came across your profile while researching engineering roles at Google, and your work on search infrastructure stood out. Would you be available for a brief 15 to 20 minute conversation at your convenience?\n\nBest regards,\n${f}`;
    case 'referral':
      return `Hi Alex,\n\nMy name is ${f}, and I'm a junior studying Computer Science at USC. I noticed an open Software Engineer position on your team at Google that aligns well with my experience. Would you be open to referring me or connecting me with the appropriate hiring contact?\n\nThank you for your time,\n${f}`;
    case 'follow_up':
      return `Hi Alex,\n\nI wanted to follow up on my previous message. I understand you have a busy schedule, and I'd still welcome the opportunity to speak with you briefly if your availability allows. Please don't hesitate to suggest a time that works best.\n\nBest regards,\n${f}`;
  }
}

export default function OutreachTemplateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const qc = useQueryClient();
  const { profile, showToast } = useApp();

  const isElite = profile.tier === 'Elite';
  const firstName = (profile.name || '').trim().split(/\s+/)[0] || '';

  const templateQuery = useQuery({ queryKey: qk.emailTemplate, queryFn: fetchEmailTemplate });
  const savedQuery = useQuery({
    queryKey: qk.savedEmailTemplates,
    queryFn: fetchSavedTemplates,
    enabled: isElite,
  });
  const savedTemplates = savedQuery.data ?? [];

  // 'networking' | 'referral' | 'follow_up' | 'custom'
  const [purpose, setPurpose] = useState<string>('networking');
  const [templateName, setTemplateName] = useState('');
  const [subjectLine, setSubjectLine] = useState('');
  const [instructions, setInstructions] = useState('');
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [signoff, setSignoff] = useState('Best,');
  const [signoffCustom, setSignoffCustom] = useState('');
  const [signatureBlock, setSignatureBlock] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Hydrate the form once from the saved default (and, on Elite, the saved
  // list so a savedTemplateId can resolve to its pill). Guarded so later
  // refetches never clobber in-progress edits.
  const hydrated = useRef(false);
  const savedReady = !isElite || savedQuery.isSuccess || savedQuery.isError;
  useEffect(() => {
    if (hydrated.current || !templateQuery.data || !savedReady) return;
    hydrated.current = true;
    const t = templateQuery.data;
    const saved = savedQuery.data ?? [];

    setSignoff(SIGNOFFS.includes(t.signoffPhrase) ? t.signoffPhrase : CUSTOM);
    setSignoffCustom(SIGNOFFS.includes(t.signoffPhrase) ? '' : t.signoffPhrase);
    setSignatureBlock(t.signatureBlock);

    if (t.purpose === CUSTOM) {
      setPurpose(CUSTOM);
      setTemplateName(t.name);
      setSubjectLine(t.subject);
      setInstructions(t.customInstructions);
      setActiveSavedId(t.savedTemplateId);
    } else if (t.savedTemplateId) {
      const match = saved.find((s) => s.id === t.savedTemplateId);
      if (match) {
        setPurpose(CUSTOM);
        setTemplateName(match.name);
        setSubjectLine(match.subject);
        setInstructions(match.body);
        setActiveSavedId(match.id);
      } else {
        setPurpose(t.purpose || 'networking');
      }
    } else {
      setPurpose(t.purpose || 'networking');
    }
  }, [templateQuery.data, savedReady, savedQuery.data]);

  const isCustom = purpose === CUSTOM;
  const effectiveSignoff = signoff === CUSTOM ? signoffCustom.trim() || 'Best,' : signoff;

  const pickPreset = (key: PurposeKey) => {
    setPurpose(key);
    setActiveSavedId(null);
    setTemplateName('');
    setSubjectLine('');
    setInstructions('');
  };

  const pickSaved = (t: SavedTemplate) => {
    setPurpose(CUSTOM);
    setTemplateName(t.name);
    setSubjectLine(t.subject);
    setInstructions(t.body);
    setActiveSavedId(t.id);
  };

  const startCustom = () => {
    setPurpose(CUSTOM);
    setActiveSavedId(null);
    setTemplateName('');
    setSubjectLine('');
    setInstructions('');
  };

  const confirmDelete = (t: SavedTemplate) => {
    Alert.alert(`Delete "${t.name}"?`, 'This removes the saved template for good.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            if (deletingId) return;
            setDeletingId(t.id);
            try {
              await deleteSavedTemplate(t.id);
              qc.setQueryData<SavedTemplate[]>(qk.savedEmailTemplates, (prev) =>
                (prev ?? []).filter((s) => s.id !== t.id),
              );
              if (activeSavedId === t.id) pickPreset('networking');
              showToast('Template deleted');
            } catch {
              showToast("Couldn't delete that. Try again.");
            } finally {
              setDeletingId(null);
            }
          })();
        },
      },
    ]);
  };

  const onSave = async () => {
    if (saving) return;
    if (isCustom && !templateName.trim()) {
      showToast('Give your template a name first');
      return;
    }
    setSaving(true);
    try {
      let savedId = activeSavedId;

      // Elite custom templates also get saved to the reusable list, so they
      // show up as a pill next time. Non-fatal if it fails; the default save
      // below is the one that changes drafts.
      if (isCustom && isElite) {
        try {
          const res = await createSavedTemplate({
            id: activeSavedId || undefined,
            name: templateName.trim(),
            subject: subjectLine.trim(),
            body: instructions.trim(),
          });
          savedId = res.id;
          setActiveSavedId(res.id);
          const entry: SavedTemplate = {
            id: res.id,
            name: templateName.trim(),
            subject: subjectLine.trim(),
            body: instructions.trim(),
          };
          qc.setQueryData<SavedTemplate[]>(qk.savedEmailTemplates, (prev) => {
            const list = prev ?? [];
            const idx = list.findIndex((s) => s.id === entry.id);
            if (idx >= 0) {
              const copy = [...list];
              copy[idx] = entry;
              return copy;
            }
            return [entry, ...list];
          });
        } catch {
          // keep going, the default save still applies the instructions
        }
      }

      await saveEmailTemplate({
        purpose: isCustom ? CUSTOM : purpose,
        customInstructions: isCustom ? instructions.trim().slice(0, MAX_INSTRUCTIONS) : '',
        signoffPhrase: effectiveSignoff,
        signatureBlock: signatureBlock.trim().slice(0, 500),
        name: isCustom ? templateName.trim() : '',
        subject: isCustom ? subjectLine.trim() : '',
        savedTemplateId: isCustom ? savedId : null,
      });
      await qc.invalidateQueries({ queryKey: qk.emailTemplate });
      showToast('Template saved. New drafts will use it.');
      router.back();
    } catch {
      showToast("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const preview = !isCustom ? previewBody(purpose as PurposeKey, firstName) : null;

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
          Outreach template
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      {templateQuery.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.navy} />
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: insets.bottom + 32 }}>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 20 }}>
            This shapes how every drafted email is written. Pick what you're asking for, set your
            sign-off, and each draft follows it (personalized to the contact).
          </Text>

          {/* What kind of email */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
              What kind of email?
            </Text>
            {PURPOSES.map((p) => {
              const selected = purpose === p.key;
              return (
                <Pressable key={p.key} onPress={() => pickPreset(p.key)}>
                  <Card
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      borderColor: selected ? colors.accent : colors.hairline,
                      borderWidth: selected ? 1.5 : 1,
                    }}>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: selected ? colors.accent : colors.hairline,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      {selected ? (
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} />
                      ) : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
                        {p.label}
                      </Text>
                      <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkSecondary, lineHeight: 17 }}>
                        {p.sub}
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>

          {/* Saved custom templates (Elite) */}
          {isElite && savedTemplates.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
                Your templates
              </Text>
              {savedTemplates.map((t) => {
                const selected = activeSavedId === t.id && isCustom;
                return (
                  <Pressable key={t.id} onPress={() => pickSaved(t)}>
                    <Card
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        borderColor: selected ? colors.accent : colors.hairline,
                        borderWidth: selected ? 1.5 : 1,
                        opacity: deletingId === t.id ? 0.5 : 1,
                      }}>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: colors.accent + '14',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                        <Ionicons name="document-text-outline" size={17} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }} numberOfLines={1}>
                          {t.name}
                        </Text>
                        {t.subject ? (
                          <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }} numberOfLines={1}>
                            {t.subject}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => confirmDelete(t)}
                        disabled={deletingId === t.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${t.name}`}
                        hitSlop={8}
                        style={{ padding: 4 }}>
                        <Ionicons name="trash-outline" size={17} color={colors.inkTertiary} />
                      </Pressable>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Create your own (Elite) */}
          {isElite ? (
            <View style={{ gap: 8 }}>
              <Pressable onPress={isCustom ? undefined : startCustom}>
                <Card
                  style={{
                    gap: 12,
                    borderColor: isCustom ? colors.accent : colors.hairline,
                    borderWidth: isCustom ? 1.5 : 1,
                  }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: colors.navy + '12',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Ionicons name="create-outline" size={18} color={colors.navy} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
                        {activeSavedId && isCustom ? 'Edit this template' : 'Create your own'}
                      </Text>
                      <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkSecondary }}>
                        Describe what your emails should say, in plain English
                      </Text>
                    </View>
                    <Ionicons
                      name={isCustom ? 'chevron-down' : 'chevron-forward'}
                      size={16}
                      color={colors.inkTertiary}
                    />
                  </View>

                  {isCustom ? (
                    <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: colors.hairlineLight, paddingTop: 12 }}>
                      <View style={{ gap: 6 }}>
                        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.inkSecondary }}>
                          Template name
                        </Text>
                        <Input
                          value={templateName}
                          onChangeText={(v) => setTemplateName(v.slice(0, 200))}
                          placeholder="e.g. Startup pitch, Alumni intro"
                          autoCapitalize="sentences"
                        />
                      </View>
                      <View style={{ gap: 6 }}>
                        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.inkSecondary }}>
                          Subject line (optional)
                        </Text>
                        <Input
                          value={subjectLine}
                          onChangeText={(v) => setSubjectLine(v.slice(0, 500))}
                          placeholder="e.g. Quick question from a fellow Trojan"
                          autoCapitalize="sentences"
                        />
                      </View>
                      <View style={{ gap: 6 }}>
                        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.inkSecondary }}>
                          What should the email do?
                        </Text>
                        <Input
                          multiline
                          value={instructions}
                          onChangeText={(v) => setInstructions(v.slice(0, MAX_INSTRUCTIONS))}
                          placeholder="e.g. Write a three sentence email pitching my startup and asking for a 15 minute call. Mention I run the product side."
                        />
                        <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.inkTertiary, textAlign: 'right' }}>
                          {MAX_INSTRUCTIONS - instructions.length} characters left
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </Card>
              </Pressable>
            </View>
          ) : (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: 0.7 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="lock-closed-outline" size={17} color={colors.inkTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
                  Create your own template
                </Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                  Describe exactly what your emails should say
                </Text>
              </View>
              <Chip label="Elite" tone="brand" />
            </Card>
          )}

          {/* Preview */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
              Preview
            </Text>
            <Card style={{ gap: 10 }}>
              {preview ? (
                <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.ink, lineHeight: 20 }}>
                  {preview}
                </Text>
              ) : (
                <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 20 }}>
                  Your emails will be generated from the instructions above, personalized to each
                  contact.
                </Text>
              )}
              <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary, lineHeight: 16 }}>
                This is a sample. Real drafts are personalized to each contact, with your resume and
                background woven in.
              </Text>
            </Card>
          </View>

          {/* Sign-off and signature */}
          <View style={{ gap: 10 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
              Sign-off
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[...SIGNOFFS, CUSTOM].map((s) => {
                const selected = signoff === s;
                const label = s === CUSTOM ? 'Custom' : s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => {
                      setSignoff(s);
                      if (s !== CUSTOM) setSignoffCustom('');
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: selected ? colors.accent : colors.hairline,
                      backgroundColor: selected ? colors.accent : colors.paper,
                    }}>
                    <Text
                      style={{
                        fontFamily: selected ? fonts.sansSemibold : fonts.sansMedium,
                        fontSize: 13,
                        color: selected ? colors.paper : colors.inkSecondary,
                      }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {signoff === CUSTOM ? (
              <Input
                value={signoffCustom}
                onChangeText={(v) => setSignoffCustom(v.slice(0, 50))}
                placeholder="e.g. Go Trojans,"
                autoCapitalize="sentences"
              />
            ) : null}
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.inkSecondary }}>
                Signature block (name, school, links)
              </Text>
              <Input
                multiline
                value={signatureBlock}
                onChangeText={(v) => setSignatureBlock(v.slice(0, 500))}
                placeholder={'Your name\nSchool and grad year\nlinkedin.com/in/you'}
              />
            </View>
          </View>

          <Button
            label={saving ? 'Saving…' : 'Save template'}
            variant="brand"
            size="lg"
            fullWidth
            icon="checkmark"
            disabled={saving}
            onPress={() => void onSave()}
          />
          <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary, textAlign: 'center', lineHeight: 16 }}>
            Applies to every new draft, here and on offerloop.ai. Emails already drafted keep their
            wording.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
