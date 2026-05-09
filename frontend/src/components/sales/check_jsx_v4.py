import re

def check_jsx_balance(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    stack = []
    for i, line in enumerate(lines):
        line_num = i + 1
        # Remove comments
        line = re.sub(r'//.*', '', line)
        
        # This is a very rough check
        # Find all tags in line
        # We need to ignore tags inside strings, but for now let's just find them
        matches = re.finditer(r'<(/?)([a-zA-Z0-9.]+)([^>]*)>', line)
        for m in matches:
            closing = m.group(1) == '/'
            name = m.group(2)
            attrs = m.group(3)
            
            # Skip self-closing
            if attrs.strip().endswith('/') or name.lower() in ['img', 'br', 'hr', 'input', 'link', 'meta', 'CashFundModal', 'CameraScanner', 'TicketVenta', 'TicketReimpresion']:
                if not closing: continue
            
            if closing:
                if not stack:
                    print(f"L{line_num}: Extra closing tag </{name}>")
                else:
                    last_name, last_line = stack.pop()
                    if last_name != name:
                        print(f"L{line_num}: Mismatched tag </{name}>, expected </{last_name}> from L{last_line}")
            else:
                stack.append((name, line_num))
    
    for name, line_num in reversed(stack):
        print(f"Unclosed tag <{name}> from L{line_num}")

import sys
check_jsx_balance(sys.argv[1])
