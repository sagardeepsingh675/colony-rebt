interface LoadingProps {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
    fullScreen?: boolean;
}

const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-4',
};

export function Loading({ size = 'md', text, fullScreen = false }: LoadingProps) {
    const content = (
        <div className="flex flex-col items-center justify-center gap-3">
            <div className={`${sizeClasses[size]} border-slate-200 border-t-indigo-600 rounded-full animate-spin`} />
            {text && <p className="text-slate-500 text-sm">{text}</p>}
        </div>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50">
                {content}
            </div>
        );
    }

    return content;
}

export function LoadingOverlay({ text = 'Loading...' }: { text?: string }) {
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-2xl z-10">
            <Loading text={text} />
        </div>
    );
}

export function PageLoading() {
    return (
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
            <Loading size="lg" text="Loading..." />
        </div>
    );
}
