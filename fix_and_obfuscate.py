import re
import subprocess

print("Step 1: Reading clean index.html from local file...")
with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()
print(f"Restored: {len(content)} characters")

print("Step 2: Applying duplicate month fix...")
old = "history.forEach(month => {"
new = """const filteredHistory = history.filter(month => 
      !(month.startDate === billData.startDate && month.endDate === billData.endDate)
    );
    filteredHistory.forEach(month => {"""

if old not in content:
    print("ERROR: Could not find history.forEach - fix not applied!")
    exit(1)

content = content.replace(old, new, 1)
print("Fix applied:", "filteredHistory" in content)

print("Step 3: Saving clean fixed version...")
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Step 4: Extracting JavaScript...")
scripts = re.findall(r'<script>(.*?)</script>', content, re.DOTALL)
if not scripts:
    print("ERROR: No script blocks found!")
    exit(1)

js_code = scripts[-1]
with open('temp_script.js', 'w', encoding='utf-8') as f:
    f.write(js_code)
print(f"Extracted: {len(js_code)} characters of JS")

print("Step 5: Obfuscating...")
result = subprocess.run([
    'javascript-obfuscator', 'temp_script.js',
    '--output', 'temp_obfuscated.js',
    '--target', 'browser',
    '--string-array', 'true',
    '--string-array-rotate', 'true',
    '--string-array-shuffle', 'true',
    '--string-array-encoding', 'base64',
    '--compact', 'true',
    '--simplify', 'true',
    '--self-defending', 'true',
    '--rename-globals', 'false',
    '--rename-properties', 'false'
], shell=True, capture_output=True, text=True)

if result.returncode != 0:
    print("ERROR: Obfuscation failed:", result.stderr)
    exit(1)

print("Obfuscation complete")

print("Step 6: Injecting obfuscated JS back into HTML...")
with open('temp_obfuscated.js', 'r', encoding='utf-8') as f:
    obfuscated = f.read()

new_content = re.sub(
    r'<script>.*?</script>(\s*</body>)',
    '<script>' + obfuscated + '</script>\\1',
    content,
    flags=re.DOTALL,
    count=1
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Step 7: Verifying...")
verify = open('index.html', 'r', encoding='utf-8').read()
print("Has obfuscated code:", len(verify) > 100000)

print("\nAll done! Now run:")
print("  git add .")
print("  git commit -m 'Fixed duplicate month + obfuscated v5.0'")
print("  git push origin master:main")
