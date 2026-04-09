import re

file_path = r'c:\Users\madha\Desktop\doc popclozet\popclozet\apps\customer-app\src\pages\MobileHome.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# find the line with the border we just added
start_line = -1
for i, line in enumerate(lines):
    if 'border border-white/5' in line and 'relative w-[220px]' in line:
        start_line = i
        break

if start_line == -1:
    print("Could not find start line")
    exit(1)

# find the end of the motion.div
end_line = -1
for i in range(start_line + 1, len(lines)):
    if '</motion.div>' in lines[i]:
        end_line = i
        break

if end_line == -1:
    print("Could not find end line")
    exit(1)

# Replace everything between start_line and end_line
new_content = [
    lines[start_line],
    '                                >\n',
    '                                    <img\n',
    '                                        src={filteredSlides[activeSlide].image}\n',
    '                                        alt={filteredSlides[activeSlide].title}\n',
    '                                        className="w-full h-full object-cover"\n',
    '                                    />\n',
    '                                </motion.div>\n'
]

final_lines = lines[:start_line] + new_content + lines[end_line+1:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(final_lines)

print("Successfully fixed MobileHome.tsx")
