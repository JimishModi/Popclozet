import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Product, productService } from "@/services/productService";
import { fullImage } from "@/lib/optimizeImage";
import { cn } from "@/lib/utils";

interface RecommendedProductsProps {
  currentProduct: Product;
}

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

export const RecommendedProducts: React.FC<RecommendedProductsProps> = ({ currentProduct }) => {
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true);
      const cat = currentProduct.category || (currentProduct as any).eventCategory || 'clothing';
      const results = await productService.getRecommendedProducts(cat, currentProduct.id, 8);
      setRecommendations(results);
      setLoading(false);
    };

    if (currentProduct.id) {
      fetchRecommendations();
    }
  }, [currentProduct.id, currentProduct.eventCategory]);

  if (loading) {
    return (
      <div className="mt-12 px-5">
        <div className="h-6 bg-white/5 rounded-lg w-48 mb-6 animate-pulse" />
        <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[170px] aspect-[3/4] bg-white/5 rounded-3xl animate-pulse flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) return null;

  return (
    <div className="mt-12 px-5 pb-10">
      <h2 
        className="text-xl font-bold text-white mb-6 tracking-tight" 
        style={dmSans}
      >
        You May Also Like
      </h2>
      
      <div className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-4 -mx-5 px-5">
        {recommendations.map((item, idx) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="flex-shrink-0 w-[170px]"
          >
            <Link to={`/product/${item.id}`} className="block">
              <div className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-[#1A1A1A] border border-white/5 shadow-2xl">
                <img 
                  src={fullImage(item.imageUrl)} 
                  alt={item.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {/* Price Tag Overlay */}
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="bg-black/60 backdrop-blur-md rounded-2xl p-2.5 border border-white/10">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1">Rent</p>
                    <p className="text-sm font-black text-white" style={dmSans}>₹ {item.rentalPrice || item.price}</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 px-1">
                <h3 className="text-sm font-bold text-zinc-100 line-clamp-1 truncate" style={dmSans}>{item.name}</h3>
                <p className="text-[10px] font-bold text-[#f2546d] uppercase tracking-widest mt-1">
                  {item.brand || 'Premium'}
                </p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
