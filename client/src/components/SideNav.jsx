const ITEMS = [
  { key: 'risks', icon: '📋', label: 'Boards' },
  { key: 'projects', icon: '🗂️', label: 'Projects' },
];

export default function SideNav({ view, onSelect }) {
  return (
    <nav className="sidenav">
      {ITEMS.map((item) => (
        <div
          key={item.key}
          className={`sidenav-item${view === item.key ? ' active' : ''}`}
          title={item.label}
          onClick={() => onSelect(item.key)}
        >
          <span className="sidenav-icon">{item.icon}</span>
          <span className="sidenav-label">{item.label}</span>
        </div>
      ))}
    </nav>
  );
}
