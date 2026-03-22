import os
import re

def replace_palette(directory):
    patterns = [
        # Backgrounds (excluding very light variants used for badges)
        (r'\bbg-emerald-(300|400|500|600)\b', r'bg-blue-\1'),
        (r'\bhover:bg-emerald-(300|400|500|600|700)\b', r'hover:bg-blue-\1'),
        
        # Text (excluding 700/800 usually used in badges)
        (r'\btext-emerald-(300|400|500|600)\b', r'text-blue-\1'),
        (r'\bhover:text-emerald-\b', r'hover:text-blue-'),
        (r'\bgroup-hover:text-emerald-\b', r'group-hover:text-blue-'),
        
        # Borders and Rings
        (r'\bborder-emerald-(200|300|400|500|600)\b', r'border-blue-\1'),
        (r'\bhover:border-emerald-\b', r'hover:border-blue-'),
        (r'\bfocus:border-emerald-\b', r'focus:border-blue-'),
        (r'\bring-emerald-\b', r'ring-blue-'),
        (r'\bfocus:ring-emerald-(100|200|300|400|500)\b', r'focus:ring-blue-\1'),
        
        # Shadows
        (r'\bshadow-emerald-\b', r'shadow-blue-'),
        
        # Gradients
        (r'\bfrom-emerald-\b', r'from-blue-'),
        (r'\bvia-emerald-\b', r'via-blue-'),
        (r'\bto-emerald-\b', r'to-blue-'),
        (r'\bfrom-teal-\b', r'from-indigo-'),
        (r'\bvia-teal-\b', r'via-indigo-'),
        (r'\bto-teal-\b', r'to-indigo-'),
        
        # Translucent backgrounds sometimes used
        (r'\bbg-emerald-(400|500|600)/', r'bg-blue-\1/'),
    ]
    
    # We will compile the regexes
    compiled_patterns = [(re.compile(p[0]), p[1]) for p in patterns]

    changed_files = 0
    
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                # don't modify the landing page itself except if it has leftover dashboard colors
                # actually page.tsx is fine to modify if it happens to have them
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                original_content = content
                
                for regex, replacement in compiled_patterns:
                    content = regex.sub(replacement, content)
                
                if content != original_content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"Updated {filepath}")
                    changed_files += 1

    print(f"Total files updated: {changed_files}")

if __name__ == "__main__":
    replace_palette('/home/gaibarra/materialidad/frontend/src')
