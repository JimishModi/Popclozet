import React from 'react';

interface ClosetIconProps {
    className?: string;
}

export const ClosetIcon: React.FC<ClosetIconProps> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {/* Hanger hook */}
        <path d="M12 2c-1.1 0-2 .9-2 2 0 .7.4 1.4 1 1.7" />
        {/* Hanger body */}
        <path d="M12 6l-8 6h16l-8-6z" />
        {/* Bar */}
        <line x1="4" y1="12" x2="4" y2="22" />
        <line x1="20" y1="12" x2="20" y2="22" />
        <line x1="4" y1="22" x2="20" y2="22" />
    </svg>
);

export default ClosetIcon;
