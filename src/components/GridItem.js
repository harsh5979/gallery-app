import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Expand, Download } from 'lucide-react';
import DeleteConfirmation from './DeleteConfirmation';

export default function GridItem({ img, index, isLast, lastImageRef, currentFolder, setSelectedImage, role, onDelete }) {
    const [isLoaded, setIsLoaded] = useState(false);

    const encodedFolder = currentFolder ? currentFolder.split('/').map(p => encodeURIComponent(p)).join('/') : 'root';
    const encodedImg = encodeURIComponent(img);
    const imgSrc = `/api/images/${encodedFolder}/${encodedImg}`;

    const isVideo = /\.(mp4|webm|mov|mkv)$/i.test(img);

    return (
        <motion.div
            ref={isLast ? lastImageRef : null}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="relative group rounded-xl overflow-hidden glass-card aspect-square bg-white/5"
        >
            {/* Admin Delete Menu */}
            {role === 'admin' && <DeleteConfirmation path={currentFolder ? `${currentFolder}/${img}` : img} onDelete={onDelete} />}

            {!isLoaded && !isVideo && (
                <div className="absolute inset-0 z-10 bg-white/10 animate-pulse" />
            )}

            {isVideo ? (
                <video
                    src={imgSrc}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onClick={() => setSelectedImage(img)}
                    muted
                    loop
                    onLoadedData={() => setIsLoaded(true)}
                    onMouseOver={e => e.target.play()}
                    onMouseOut={e => e.target.pause()}
                />
            ) : (
                <Image
                    src={imgSrc}
                    alt={img}
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                    className={`object-cover transition-all duration-500 group-hover:scale-110 ${isLoaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'}`}
                    onLoad={() => setIsLoaded(true)}
                    onClick={() => setSelectedImage(img)}
                />
            )}

            {/* Hover Controls */}
            <div
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 cursor-pointer z-20"
                onClick={() => setSelectedImage(img)}
            >
                <button
                    onClick={(e) => { e.stopPropagation(); setSelectedImage(img); }}
                    className="p-2 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md transition"
                >
                    <Expand size={20} />
                </button>
                <a
                    href={imgSrc}
                    download
                    className="p-2 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md transition"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Download size={20} />
                </a>
            </div>
            {/* Filename Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs truncate z-20">
                {img}
            </div>
        </motion.div>
    );
}
