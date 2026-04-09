import re
import os

file_path = r'c:\Users\madha\Desktop\doc popclozet\popclozet\apps\customer-app\src\pages\MobileHome.tsx'

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    exit(1)

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update threshold for better swipe sensitivity
new_content = content.replace('const threshold = 50;', 'const threshold = 30;')

# 2. Refactor the center card to remove onClick and overlays
pattern = re.compile(
    r'(<motion\.div[^>]+?key=\{activeSlide\}[^>]+?)(className="[^"]*?cursor-pointer[^"]*?")([^>]*?)(onClick=\{[^}]*?\}\s*)(>[\s\S]+?)(<div className="absolute[^"]*?backdrop-blur-md[^"]*?">[\s\S]+?</div>)(\s+)(</motion\.div>)',
    re.MULTILINE
)

# We want to:
# - Remove cursor-pointer from className
# - Remove the onClick prop
# - Remove the overlay div (the one with backdrop-blur-md)
# - Remove the gradient overlay too (the one before the title overlay)

# Let's try a more specific approach for the center card content
center_card_pattern = re.compile(
    r'(<motion\.div[^>]+?key=\{activeSlide\}[\s\S]+?)(className="[^"]+?)(cursor-pointer)(\s+)([^"]+?")([\s\S]+?)(onClick=\{[\s\S]+?\}\s+)(>[\s\S]+?<img[\s\S]+?/>[\s\S]+?)(<div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />[\s\S]+?<div className="absolute bottom-3 left-3 right-3 md:bottom-6 md:left-6 md:right-6 backdrop-blur-md bg-white/10 border border-white/20 rounded-xl md:rounded-2xl p-2.5 md:p-4 text-center">[\s\S]+?</div>)(\s+)(</motion\.div>)',
    re.MULTILINE
)

def center_card_replacement(match):
    prefix = match.group(1)
    class_start = match.group(2)
    # class_mid is 'cursor-pointer'
    class_end = match.group(5)
    remaining_props = match.group(6)
    # onClick is match.group(7)
    img_part = match.group(8)
    # overlays is match.group(9)
    suffix = match.group(11)

    # Remove cursor-pointer and add border
    new_class = f'{class_start} border border-white/5{class_end}'

    return f'{prefix}{new_class}{remaining_props}>{img_part}{suffix}'

# Apply the replacement
final_content = center_card_pattern.sub(center_card_replacement, new_content)

if final_content == new_content:
    print("Warning: Pattern not found with re.sub, trying direct replace for the whole block...")
    # fallback: replace the specific block found in previous view_file
    target_block = """                                    className="relative w-[220px] h-[220px] md:w-[260px] md:h-[340px] rounded-[24px] md:rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] cursor-pointer bg-zinc-900"
                                    onClick={() => {
                                        const slide = filteredSlides[activeSlide];
                                        const categoryMap: Record<string, string> = {
                                            'New Arrivals': 'Casual',
                                            'Trending Now': 'Party',
                                            'Party Collection': 'Party',
                                            "Men's Streetwear": 'Casual',
                                            'Formal Classics': 'Formal'
                                        };
                                        const cat = categoryMap[slide.title] || 'Casual';
                                        navigate(`/category?title=${encodeURIComponent(slide.title)}&category=${cat}`);
                                    }}
                                >
                                    <img
                                        src={filteredSlides[activeSlide].image}
                                        alt={filteredSlides[activeSlide].title}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                                    <div className="absolute bottom-3 left-3 right-3 md:bottom-6 md:left-6 md:right-6 backdrop-blur-md bg-white/10 border border-white/20 rounded-xl md:rounded-2xl p-2.5 md:p-4 text-center">
                                        <span className="inline-block px-2 py-0.5 rounded-full bg-[#f2546d] text-white text-[8px] md:text-[10px] font-bold uppercase tracking-wider mb-1 md:mb-2">
                                            Trending
                                        </span>
                                        <h3 className="text-base md:text-xl font-bold text-white tracking-tight">
                                            {filteredSlides[activeSlide].title}
                                        </h3>
                                    </div>
                                </motion.div>"""

    new_block = """                                    className="relative w-[220px] h-[220px] md:w-[260px] md:h-[340px] rounded-[24px] md:rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-zinc-900 border border-white/5"
                                >
                                    <img
                                        src={filteredSlides[activeSlide].image}
                                        alt={filteredSlides[activeSlide].title}
                                        className="w-full h-full object-cover"
                                    />
                                </motion.div>"""

    final_content = new_content.replace(target_block, new_block)

if final_content == content:
    print("Failure: Nothing was changed.")
else:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(final_content)
    print("Successfully updated MobileHome.tsx")
