import { ReactNode } from "react";

interface PageTransitionProps {
    children: ReactNode;
    className?: string;
}

const PageTransition = ({ children, className = "" }: PageTransitionProps) => {
    return (
        <div className={`w-full h-full ${className}`}>
            {children}
        </div>
    );
};

export default PageTransition;
