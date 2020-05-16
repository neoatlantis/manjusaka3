#!/usr/bin/env python3

import sys
import subprocess 

try:
    INPUT = sys.argv[1]

except:
    print("Compiles a manjusaka XML file, and generates HTML with runtime.")
    print("Usage: python3 manjusaka-compile-cli.py <INPUTFILE>")
    exit(1)


datajs = subprocess.check_output(["node", "manjusaka3/index.js", "compile", INPUT]).decode("UTF-8")

example = open("web/index.html", "r").read()

start = example.find("// DATA_BEGIN")
end = example.find("// DATA_END")

print(example[:start] + datajs + example[end:])
