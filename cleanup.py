import os

path = r'c:\Users\madha\Desktop\doc popclozet\popclozet\apps\customer-app\src\pages\MobileHome.tsx'

with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

new_lines = []
skip1_start = 455 # index 455 is line 456
skip1_end = 466   # index 466 is line 467
skip2_start = 473 # index 473 is line 474
skip2_end = 482   # index 482 is line 483

for i, line in enumerate(lines):
    line_num = i + 1
    if line_num >= 456 and line_num <= 467:
        continue
    if line_num >= 474 and line_num <= 483:
        continue
    new_lines.append(line)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Successfully cleaned MobileHome.tsx")
