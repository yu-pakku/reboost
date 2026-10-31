'use client';
import { useStatistics } from '@/data/use-statistics';
export function LearningStatistics() {
  const { statistics: stats, error } = useStatistics();
  return <section className="section-block" aria-labelledby="statistics-title"><h2 id="statistics-title" className="section-title">学習の記録</h2>{error ? <p className="error-box" role="alert">{error}</p> : !stats ? <p role="status">統計を読み込み中…</p> : <>
    <dl className="stats-grid">{[{ name: '登録知識数', value: stats.registered, unit: '件' }, { name: '定着済み（アプリ判定）', value: stats.mastered, unit: '件' }, { name: '学習中', value: stats.learning, unit: '件' }, { name: '復習実施回数', value: stats.reviews, unit: '回' }, { name: '最終テスト合格', value: stats.final_passed, unit: '回' }, { name: '最終テスト不合格', value: stats.final_failed, unit: '回' }].map(item => <div key={item.name}><dt>{item.name}</dt><dd>{item.value}<span>{item.unit}</span></dd></div>)}</dl>
    <p className="field-note">登録数はアーカイブを含みます。復習回数は通常回答1件・最終テスト1受験を各1回と数えます。削除した知識の履歴は除かれます。</p><h3 className="activity-heading">日別の学習履歴（日本時間）</h3>{stats.days.length === 0 ? <p className="field-note">まだ学習履歴はありません。</p> : <div className="activity-scroll"><table className="activity-table"><thead><tr><th scope="col">日付</th><th scope="col">復習</th><th scope="col">最終合格</th><th scope="col">最終不合格</th></tr></thead><tbody>{stats.days.map(row => <tr key={row.day}><th scope="row">{row.day}</th><td>{row.reviews}回</td><td>{row.final_passed}回</td><td>{row.final_failed}回</td></tr>)}</tbody></table></div>}
    <p className="field-note">定着済みはアプリ内の達成状態であり、永久記憶の保証ではありません。</p>
  </>}</section>;
}
