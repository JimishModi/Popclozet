import { useState, useEffect, useRef } from "react";
import { Send, User, Headset, X } from "lucide-react";
import { supabase } from "@popclozet/api-client";
import { useAuth } from "@/context/SupabaseAuthContext";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
    id: string;
    message: string;
    sender_type: "customer" | "support";
    created_at: string;
    priority?: "standard" | "premium";
}

interface OrderChatProps {
    orderId: string;
    onClose: () => void;
    supportTier?: "standard" | "premium" | null;
}

export function OrderChat({ orderId, onClose, supportTier }: OrderChatProps) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!orderId || !user) return;

        // Fetch existing messages
        const fetchMessages = async () => {
            const { data, error } = await supabase
                .from("order_support_chats")
                .select("*")
                .eq("order_id", orderId)
                .order("created_at", { ascending: true });

            if (!error && data) {
                setMessages(data);
            }
            setIsLoading(false);
        };

        fetchMessages();

        // Subscribe to new messages
        let channel: ReturnType<typeof supabase.channel> | null = null;
        try {
            channel = supabase
                .channel(`order_chat:${orderId}`)
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "order_support_chats",
                        filter: `order_id=eq.${orderId}`,
                    },
                    (payload) => {
                        setMessages((prev) => [...prev, payload.new as Message]);
                    }
                )
                .subscribe((status, err) => {
                    if (err) console.warn('[OrderChat] Realtime subscription error (non-fatal):', err);
                });
        } catch (err) {
            console.warn('[OrderChat] Failed to subscribe to chat realtime (non-fatal):', err);
        }

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [orderId, user]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user) return;

        const msg = newMessage.trim();
        setNewMessage("");

        const { error } = await supabase.from("order_support_chats").insert({
            order_id: orderId,
            user_id: user.id,
            message: msg,
            sender_type: "customer",
        });

        if (error) {
            console.error("Failed to send message:", error);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col h-[500px] bg-zinc-900 rounded-t-3xl border-t border-zinc-800"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <Headset className="w-5 h-5 text-[#f2546d]" />
                    <div>
                        <h3 className="font-bold text-white">Order Support</h3>
                        {supportTier === 'premium' && (
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#f2546d]">
                                Premium Support
                            </p>
                        )}
                    </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-800">
                    <X className="w-5 h-5 text-zinc-400" />
                </button>
            </div>

            {/* Messages */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar"
            >
                {isLoading ? (
                    <div className="flex justify-center py-10">
                        <div className="w-6 h-6 border-2 border-[#f2546d] border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-sm text-zinc-500">No messages yet. How can we help?</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div 
                            key={msg.id}
                            className={`flex ${msg.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                                msg.sender_type === 'customer' 
                                    ? 'bg-[#f2546d] text-white rounded-tr-none' 
                                    : 'bg-zinc-800 text-zinc-200 rounded-tl-none'
                            }`}>
                                {msg.message}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-black/50 border-t border-zinc-800">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-[#f2546d]"
                    />
                    <button 
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="p-3 rounded-xl bg-[#f2546d] text-white disabled:opacity-50"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-[10px] text-zinc-600 mt-2 text-center uppercase tracking-widest font-bold">
                    Powered by popclozet Secure
                </p>
            </form>
        </motion.div>
    );
}
