# https://stackoverflow.com/questions/3871444/making-all-rules-depend-on-the-makefile-itself
.EXTRA_PREREQS:= $(abspath $(lastword $(MAKEFILE_LIST)))

ASC_DIR := ../engine/wasmEngine/wasm/src/asc

IMAGES_DIR := ./images
STRINGS_DIR := ./strings

IMAGES_SCRIPT := $(IMAGES_DIR)/preprocImagesList.mjs
STRINGS_SCRIPT := $(STRINGS_DIR)/preprocSringsList.mjs

IMAGES_IN := $(IMAGES_DIR)/images.res
STRINGS_IN := $(STRINGS_DIR)/strings.res

BUILD_DIR := ./build

IMAGES_OUT_TS := $(BUILD_DIR)/images.ts
STRINGS_OUT_TS := $(BUILD_DIR)/strings.ts

ASC_GEN_PREFIX := _gen
# use prefix _gen for generated files for asc sources

IMAGES_OUT_TS_ASC := $(ASC_DIR)/${ASC_GEN_PREFIX}ImportImages.ts
STRINGS_OUT_TS_ASC := $(ASC_DIR)/${ASC_GEN_PREFIX}ImportStrings.ts

.PHONY: clean clean-images clean-strings

all: mk_build_dir images strings

mk_build_dir:
	@mkdir -p $(BUILD_DIR)

images: $(IMAGES_OUT_TS) $(IMAGES_OUT_TS_ASC)
	@echo 'Images assets generation terminated.'

strings: $(STRINGS_OUT_TS) $(STRINGS_OUT_TS_ASC)
	@echo 'Strings assets generation terminated.'

$(IMAGES_OUT_TS) $(IMAGES_OUT_TS_ASC): $(IMAGES_IN) $(IMAGES_SCRIPT)
	node $(IMAGES_SCRIPT) $(IMAGES_IN) $(IMAGES_OUT_TS) $(IMAGES_OUT_TS_ASC)

$(STRINGS_OUT_TS) $(STRINGS_OUT_TS_ASC): $(STRINGS_IN) $(STRINGS_SCRIPT)
	node $(STRINGS_SCRIPT) $(STRINGS_IN) $(STRINGS_OUT_TS) $(STRINGS_OUT_TS_ASC)

clean-images:
	@echo 'Cleaning images assets...'
	rm -f $(IMAGES_OUT_TS) $(IMAGES_OUT_TS_ASC)

clean-strings:
	@echo 'Cleaning strings assets...'
	rm -f $(STRINGS_OUT_TS) $(STRINGS_OUT_TS_ASC)

clean: clean-images clean-strings
