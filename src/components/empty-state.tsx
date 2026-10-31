import { Icon, type IconName } from './icon';
export function EmptyState({ title, children, icon = 'book' }: { title: string; children: React.ReactNode; icon?: IconName }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={28}/></span><h2>{title}</h2><p>{children}</p></div>;
}
