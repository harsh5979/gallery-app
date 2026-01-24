export default function GlassButton({ onClick, children, className = "", active = false, ...props }) {
    return (
        <button
            onClick={onClick}
            className={`
                p-2 md:p-3 rounded-full transition cursor-pointer backdrop-blur-md flex items-center justify-center
                ${active ? 'bg-white text-black' : 'bg-black/40 hover:bg-black/60 text-white'}
                ${className}
            `}
            {...props}
        >
            {children}
        </button>
    );
}
