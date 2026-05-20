import React from 'react';

interface ButtonProps {
  variant: 'red' | 'ghost' | 'nav-platform';
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
  className?: string;
}

export function Button({ variant, onClick, href, children, className = '' }: ButtonProps) {
  const classMap = {
    red: 'btn-red',
    ghost: 'btn-ghost',
    'nav-platform': 'nav-platform-btn',
  };

  const cls = `${classMap[variant]} ${className}`.trim();

  if (href) {
    return (
      <a href={href} className={cls} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <button className={cls} onClick={onClick} type="button">
      {children}
    </button>
  );
}
