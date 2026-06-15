export function RippleButton({ children, className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`relative overflow-hidden rounded-lg transition ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default RippleButton;
