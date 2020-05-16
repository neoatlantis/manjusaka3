all: dist/manjusaka3.runtime.min.js dist/manjusaka3.compiler.min.js dist/manjusaka3.webruntime.min.js

test: dist/manjusaka3.runtime.js dist/manjusaka3.compiler.js dist/manjusaka3.webruntime.js

dist/manjusaka3.runtime.min.js: dist/manjusaka3.runtime.js
	minify --js < dist/manjusaka3.runtime.js > dist/manjusaka3.runtime.min.js

dist/manjusaka3.runtime.js: manjusaka3/*.js
	browserify -s manjusaka3_runtime manjusaka3/runtime.js -o dist/manjusaka3.runtime.js

dist/manjusaka3.compiler.min.js: dist/manjusaka3.compiler.js
	minify --js < dist/manjusaka3.compiler.js > dist/manjusaka3.compiler.min.js

dist/manjusaka3.compiler.js: manjusaka3/*.js
	browserify -s manjusaka3_compiler manjusaka3/compiler.js -o dist/manjusaka3.compiler.js

dist/manjusaka3.webruntime.js: manjusaka3/*.js
	browserify manjusaka3/webruntime.js -s manjusaka3_webruntime -o dist/manjusaka3.webruntime.js

dist/manjusaka3.webruntime.min.js: dist/manjusaka3.webruntime.js
	minify --js < dist/manjusaka3.webruntime.js > dist/manjusaka3.webruntime.min.js
