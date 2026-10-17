import { useActingMember } from '../lib/actingMember.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';

// The header's "logging for" picker: yourself, then each Dependent. Shows nothing until the
// signed-in person has a Household.
export default function LoggingForSwitch() {
  const { t } = useI18n();
  const { actingMemberId, options, setActingMemberId } = useActingMember();

  if (options.length === 0) return null;

  return (
    <label>
      {t('loggingFor.label')}{' '}
      <select
        value={actingMemberId ?? ''}
        onChange={(event) => setActingMemberId(Number(event.target.value))}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.isSelf ? t('loggingFor.you', { name: option.name }) : option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
