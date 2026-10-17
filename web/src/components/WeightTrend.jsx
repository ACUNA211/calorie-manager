import { useI18n } from '../i18n/I18nProvider.jsx';
import { parseDateKey } from '../lib/todayLogic.js';

// The 12-week weight trend as a plain inline SVG line: each logged day is a dot and the 7-day
// average is a line through them. layout comes from trendLayout (weightLogic.js), which also
// sets the SVG size; trend gives the first and last day for the labels. No chart library.
export default function WeightTrend({ trend, layout }) {
  const { t, formatNumber, formatDate } = useI18n();

  if (!layout) return <p>{t('weight.trend.empty')}</p>;

  const number = (value) => formatNumber(value, { maximumFractionDigits: 1 });
  const dateLabel = (key) => formatDate(parseDateKey(key));

  return (
    <figure>
      <figcaption>{t('weight.trend.heading')}</figcaption>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width="100%"
        role="img"
        aria-label={t('weight.trend.chartLabel')}
        style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
      >
        {layout.averagePath ? (
          <path
            d={layout.averagePath}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.45}
            strokeWidth={2.5}
          />
        ) : null}
        {layout.dots.map((dot) => (
          <circle key={dot.key} cx={dot.x} cy={dot.y} r={3} fill="currentColor" />
        ))}
      </svg>
      <p>
        {t('weight.trend.span', { from: dateLabel(trend.startKey), to: dateLabel(trend.endKey) })}
      </p>
      <p>{t('weight.trend.range', { low: number(layout.low), high: number(layout.high) })}</p>
      <p>
        <span aria-hidden="true">● </span>
        <span>{t('weight.trend.legendDaily')}</span>
        <span aria-hidden="true"> — </span>
        <span>{t('weight.trend.legendAverage')}</span>
      </p>
    </figure>
  );
}
