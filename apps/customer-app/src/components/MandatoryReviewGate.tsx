import React, { useEffect, useState } from "react";
import { supabase } from "@popclozet/api-client";
import { useAuth } from "@/context/SupabaseAuthContext";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";

export interface PendingReviewItem {
  id: string; // order_item id
  product_id: string;
  name: string;
  image: string;
  order_id: string;
}

export function MandatoryReviewGate() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [pendingItems, setPendingItems] = useState<PendingReviewItem[]>([]);
  const [fetching, setFetching] = useState(true);
  
  // State to hold reviews: mapping order_item_id -> rating & text
  const [reviews, setReviews] = useState<Record<string, { rating: number; text: string }>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setFetching(false);
      return;
    }

    const checkPendingReviews = async () => {
      try {
        setFetching(true);
        // Supabase query to find unreviewed order items for returned/completed orders
        const { data, error } = await supabase
          .from("order_items")
          .select(`
            id,
            product_id,
            is_reviewed,
            orders!inner(id, user_id, status),
            products(name, images)
          `)
          .eq("orders.user_id", user.id)
          .in("orders.status", ["returned", "return_completed"])
          .eq("is_reviewed", false);

        if (error) {
          console.error("Error fetching pending reviews:", error);
          setFetching(false);
          return;
        }

        if (data && data.length > 0) {
          const items: PendingReviewItem[] = data.map((row: any) => ({
            id: row.id,
            product_id: row.product_id,
            order_id: row.orders.id,
            name: row.products?.name || "Product",
            // handle images carefully, often an array
            image: Array.isArray(row.products?.images) && row.products.images.length > 0 
                    ? row.products.images[0] 
                    : "",
          }));
          
          setPendingItems(items);
          
          // Initialize tracking state
          const initialReviews: Record<string, { rating: number; text: string }> = {};
          items.forEach(item => {
            initialReviews[item.id] = { rating: 0, text: "" };
          });
          setReviews(initialReviews);
        } else {
          setPendingItems([]);
        }
      } catch (err) {
        console.error("Failed to check pending reviews", err);
      } finally {
        setFetching(false);
      }
    };

    checkPendingReviews();
  }, [user, loading]);

  const handleRatingChange = (id: string, rating: number) => {
    setReviews(prev => ({ ...prev, [id]: { ...prev[id], rating } }));
  };

  const handleTextChange = (id: string, text: string) => {
    setReviews(prev => ({ ...prev, [id]: { ...prev[id], text } }));
  };

  const handleSubmit = async () => {
    // Validate all items have at least 1 star
    const missingRatings = pendingItems.some(item => reviews[item.id].rating === 0);
    if (missingRatings) {
      toast({
        variant: "destructive",
        title: "Ratings Required",
        description: "Please provide a star rating for all items.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const inserts = pendingItems.map(item => ({
        user_id: user!.id,
        product_id: item.product_id,
        order_id: item.order_id,
        rating: reviews[item.id].rating,
        review_text: reviews[item.id].text || null,
      }));

      const { error } = await supabase.from("product_reviews").insert(inserts);

      if (error) {
        // Specifically catch the unique constraint error if they somehow double submitted
        if (error.code === '23505') {
            console.log("Reviews were already submitted for some items.");
        } else {
            throw error;
        }
      }

      toast({
        title: "Thank you!",
        description: "Your reviews have been submitted.",
      });

      // Clear the gate
      setPendingItems([]);
    } catch (err: any) {
      console.error("Error submitting reviews:", err);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: "Could not submit your reviews. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (fetching || pendingItems.length === 0) {
    return null; // Do not render if nothing to review or still loading
  }

  const completedCount = pendingItems.filter(item => reviews[item.id]?.rating > 0).length;

  return (
    <AnimatePresence>
      <motion.div 
        key="review-gate"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed inset-0 z-[9999] bg-[#0a0a0a] text-white overflow-y-auto"
      >
        <div className="max-w-md mx-auto min-h-screen flex flex-col p-6 pb-24">
          <div className="text-center mt-12 mb-8">
            <h1 className="text-3xl font-heading font-bold mb-3">Rate Your Rentals</h1>
            <p className="text-neutral-400 text-sm">
              Please review your recently rented items to continue using Popclozet.
            </p>
          </div>

          <div className="space-y-6 flex-1">
            {pendingItems.map((item) => (
              <div key={item.id} className="bg-neutral-900 border border-white/5 rounded-2xl p-5 shadow-soft">
                <div className="flex items-center gap-4 mb-4">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-xl bg-neutral-800" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-neutral-800 flex items-center justify-center">
                      <Star className="w-6 h-6 text-neutral-600" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg line-clamp-1">{item.name}</h3>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleRatingChange(item.id, star)}
                      className={`p-2 transition-transform active:scale-90 ${
                        (reviews[item.id]?.rating || 0) >= star ? "text-yellow-400" : "text-neutral-700"
                      }`}
                    >
                      <Star className="w-8 h-8 fill-current" />
                    </button>
                  ))}
                </div>

                <Textarea
                  placeholder="Optional: What did you think of the fit and quality?"
                  className="bg-black/50 border-white/10 resize-none h-20 text-sm focus-visible:ring-[#f2546d]/50"
                  value={reviews[item.id]?.text || ""}
                  onChange={(e) => handleTextChange(item.id, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div 
            className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent"
            style={{ paddingBottom: 'max(16px, calc(16px + env(safe-area-inset-bottom, 0px)))' }}
          >
            <div className="max-w-md mx-auto">
              {pendingItems.length > 1 && (
                <div className="text-center text-xs text-neutral-400 mb-3 font-medium">
                  {completedCount} of {pendingItems.length} reviews completed
                </div>
              )}
              <Button 
                onClick={handleSubmit} 
                disabled={submitting || missingRatingsCheck(pendingItems, reviews)}
                className="w-full h-14 rounded-2xl bg-[#f2546d] hover:bg-[#e0435c] text-white font-bold text-lg shadow-glow"
              >
                {submitting ? "Submitting..." : "Submit Reviews"}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Helper to disable button if any items have no rating
function missingRatingsCheck(items: PendingReviewItem[], reviews: Record<string, { rating: number }>) {
  return items.some(item => !reviews[item.id] || reviews[item.id].rating === 0);
}
