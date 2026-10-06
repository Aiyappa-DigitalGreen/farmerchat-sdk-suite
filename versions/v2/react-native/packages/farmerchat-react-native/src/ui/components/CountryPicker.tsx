/**
 * CountryPickerScreen — full-screen modal country picker with search +
 * radio list + Save (docs/01 §3.4 PhoneEntryContent dialogs).
 */
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CountryItem } from '../../core/types';
import { useLabel, useSdk, useTheme } from '../context';
import { AnalyticsEvents, ScreenNames } from '../../core/analytics';
import { spacing, typography } from '../theme';
import { PrimaryButton } from './Buttons';
import { RadioRow, SearchInput } from './Inputs';
import { DefaultAppBar, LogoSpinner } from './Chrome';

export function CountryPickerModal(props: {
  visible: boolean;
  countries: CountryItem[];
  isLoading: boolean;
  initialSelected: CountryItem | null;
  onSave: (country: CountryItem) => void;
  onClose: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const sdk = useSdk();
  const label = useLabel();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CountryItem | null>(props.initialSelected);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return props.countries;
    return props.countries.filter(
      (c) =>
        c.display_name.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.phone_country_code.includes(q),
    );
  }, [props.countries, query]);

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      onRequestClose={props.onClose}
      onShow={() => {
        setSelected(props.initialSelected);
        setQuery('');
        sdk.analytics.trackScreenView(ScreenNames.SELECT_COUNTRY);
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <DefaultAppBar
          title={label('country_picker_title', 'Select your country')}
          navIcon="close"
          onNavPress={props.onClose}
        />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <SearchInput
            value={query}
            onChangeText={setQuery}
            placeholder={label('country_search_hint', 'Search country')}
          />
        </View>
        {props.isLoading ? (
          <LogoSpinner message={label('country_loading', 'Loading countries…')} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120 }}
            renderItem={({ item }) => (
              <RadioRow
                label={`${item.flag ? `${item.flag} ` : ''}${item.display_name}`}
                sublabel={`+${item.phone_country_code.replace(/^\+/, '')}`}
                selected={selected?.id === item.id}
                onPress={() => setSelected(item)}
              />
            )}
            ListEmptyComponent={
              <Text
                style={[
                  typography.body,
                  { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.xxl },
                ]}
              >
                {label('country_empty', 'No countries found')}
              </Text>
            }
          />
        )}
        <View style={[styles.footer, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <PrimaryButton
            label={label('fc_v2_app_label_save', 'Save')}
            enabled={selected !== null}
            onPress={() => {
              if (!selected) return;
              sdk.analytics.track(AnalyticsEvents.COUNTRY_SELECTED, {
                country: selected.name,
                phone_country_code: selected.phone_country_code,
              });
              props.onSave(selected);
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    borderTopWidth: 1,
  },
});
