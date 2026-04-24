interface Props {
  status: 'online' | 'offline' | 'error' | 'paused';
}

export default function StatusBadge({ status }: Props) {
  const map = {
    online:  { label: 'En línea', cls: 'badge badge-online' },
    offline: { label: 'Offline',  cls: 'badge badge-offline' },
    error:   { label: 'Error',    cls: 'badge badge-error' },
    paused:  { label: 'Pausado',  cls: 'badge badge-paused' },
  };
  const { label, cls } = map[status] ?? map.offline;
  return <span className={cls}>● {label}</span>;
}
