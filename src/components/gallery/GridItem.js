import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FileCode, FileText } from 'lucide-react';
import ItemActionsMenu from './ItemActionsMenu';

export default function GridItem({ img, index, isLast, lastImageRef, currentFolder, setSelectedImage, role, onDelete }) {
    const [isLoaded, setIsLoaded] = useState(false);
    const imageName = img.name || img; // Handle object or legacy string

    const encodedFolder = currentFolder ? currentFolder.split('/').map(p => encodeURIComponent(p)).join('/') : 'root';
    const encodedImg = encodeURIComponent(imageName);
    const imgSrc = `/api/images/${encodedFolder}/${encodedImg}`;

    const isVideo = /\.(mp4|webm|mov|mkv)$/i.test(imageName);
    const isCode = /\.(js|jsx|ts|tsx|css|html|json|md|py|java|c|cpp|h|go|rs|sql|xml|yaml|yml|log|ini|conf)$/i.test(imageName);
    const isText = /\.(txt)$/i.test(imageName);

    return (
        <motion.div
            ref={isLast ? lastImageRef : null}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="relative group rounded-xl overflow-hidden glass-card aspect-square"
            onClick={() => setSelectedImage(img)}
        >
            {/* Unified Actions Menu (Top Right) */}
            <ItemActionsMenu
                path={currentFolder ? `${currentFolder}/${imageName}` : imageName}
                filename={imageName}
                onDelete={role === 'admin' ? onDelete : null}
                onView={() => setSelectedImage(img)}
                downloadUrl={imgSrc}
            />

            {!isLoaded && !isVideo && !isCode && !isText && (
                <div className="absolute inset-0 z-10 bg-white/10 animate-pulse" />
            )}

            {isVideo ? (
                <video
                    src={imgSrc}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    muted
                    loop
                    onLoadedData={() => setIsLoaded(true)}
                    onMouseOver={e => e.target.play()}
                    onMouseOut={e => e.target.pause()}
                />
            ) : isCode || isText ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#1e1e1e] group-hover:bg-[#252526] transition-colors cursor-pointer">
                    {isCode ? <FileCode size={48} className="text-blue-400 mb-2" /> : <FileText size={48} className="text-gray-400 mb-2" />}
                    <span className="text-xs text-gray-500 font-mono px-2 text-center break-all">{imageName}</span>
                </div>
            ) : (
                <Image
                    src={imgSrc}
                    alt={imageName}
                    fill
                    priority={index < 8}
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                    className={`object-cover transition-all duration-500 group-hover:scale-105 ${isLoaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'}`}
                    onLoad={() => setIsLoaded(true)}
                />
            )}

            {/* Filename Overlay (Bottom) */}
            <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-2.5 pt-8 opacity-0 group-hover:opacity-100 transition-opacity text-xs truncate z-20 flex justify-between items-end pointer-events-none">
                <span className="truncate flex-1 text-white font-medium drop-shadow-md">{imageName}</span>
                {img.size && <span className="text-[10px] text-gray-300 ml-2 whitespace-nowrap">{img.size}</span>}
            </div>
        </motion.div>
    );
}
