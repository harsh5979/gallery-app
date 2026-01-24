import { Info, Download, X } from 'lucide-react';
import GlassButton from '../ui/GlassButton';

export default function LightboxControls({ showInfo, setShowInfo, src, onClose }) {
    return (
        <div className="absolute top-0 right-0 p-2 md:p-6 flex gap-2 md:gap-4 z-50">
            <GlassButton
                active={showInfo}
                onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
                aria-label="Toggle Info"
            >
                <Info size={20} className="md:w-6 md:h-6" />
            </GlassButton>

            <a
                href={src}
                download
                onClick={e => e.stopPropagation()}
                className="p-2 md:p-3 rounded-full bg-black/40 hover:bg-black/60 text-white transition backdrop-blur-md cursor-pointer flex items-center justify-center"
                aria-label="Download"
            >
                <Download size={20} className="md:w-6 md:h-6" />
            </a>

            <GlassButton
                onClick={onClose}
                aria-label="Close"
            >
                <X size={20} className="md:w-6 md:h-6" />
            </GlassButton>
        </div>
    );
}
