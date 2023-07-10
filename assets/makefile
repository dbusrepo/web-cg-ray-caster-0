# https://stackoverflow.com/questions/3871444/making-all-rules-depend-on-the-makefile-itself
.EXTRA_PREREQS:= $(abspath $(lastword $(MAKEFILE_LIST)))

ASC_DIR := ../src/engine/wasmEngine/wasm/src/asc

IMAGES_DIR := ./images
STRINGS_DIR := ./strings

IMAGES_SCRIPT := $(IMAGES_DIR)/genImagesList.mjs
STRINGS_SCRIPT := $(STRINGS_DIR)/genStringsList.mjs

IMAGES_IN := $(IMAGES_DIR)/images.res
STRINGS_IN := $(STRINGS_DIR)/strings.res

BUILD_DIR := ./build

IMAGES_OUT_TS := $(BUILD_DIR)/images.ts
STRINGS_OUT_TS := $(BUILD_DIR)/strings.ts

IMAGES_OUT_ASC := $(ASC_DIR)/gen_importImages.ts
STRINGS_OUT_ASC := $(ASC_DIR)/gen_importStrings.ts
# these two are define for clean only
IMAGES_OUT_ASC_DEP := $(ASC_DIR)/gen_importImages.d
STRINGS_OUT_ASC_DEP := $(ASC_DIR)/gen_importStrings.d

.PHONY: clean clean-images clean-strings

all: mk_build_dir images strings

mk_build_dir:
	@mkdir -p $(BUILD_DIR)

images: $(IMAGES_OUT_TS) $(IMAGES_OUT_ASC)
	@echo 'Images assets generation terminated.'

strings: $(STRINGS_OUT_TS) $(STRINGS_OUT_ASC)
	@echo 'Strings assets generation terminated.'

$(IMAGES_OUT_TS) $(IMAGES_OUT_ASC): $(IMAGES_IN) $(IMAGES_SCRIPT)
	node $(IMAGES_SCRIPT) $(IMAGES_IN) $(IMAGES_OUT_TS) $(IMAGES_OUT_ASC)

$(STRINGS_OUT_TS) $(STRINGS_OUT_ASC): $(STRINGS_IN) $(STRINGS_SCRIPT)
	node $(STRINGS_SCRIPT) $(STRINGS_IN) $(STRINGS_OUT_TS) $(STRINGS_OUT_ASC)

clean-images:
	@echo 'Cleaning images assets...'
	rm -f $(IMAGES_OUT_TS) $(IMAGES_OUT_ASC) $(IMAGES_OUT_ASC_DEP)

clean-strings:
	@echo 'Cleaning strings assets...'
	rm -f $(STRINGS_OUT_TS) $(STRINGS_OUT_ASC) $(STRINGS_OUT_ASC_DEP)

clean: clean-images clean-strings
