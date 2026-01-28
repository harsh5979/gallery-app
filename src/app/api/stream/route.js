import { subscribeToChanges } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            // Send initial connection message
            controller.enqueue(encoder.encode('data: connected\n\n'));

            const unsubscribe = subscribeToChanges((data) => {
                const message = `data: ${JSON.stringify(data)}\n\n`;
                controller.enqueue(encoder.encode(message));
            });

            // Clean up when connection closes
            request.signal.addEventListener('abort', () => {
                unsubscribe();
            });
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}
