# https://stackoverflow.com/questions/3871444/making-all-rules-depend-on-the-makefile-itself
.EXTRA_PREREQS:= $(abspath $(lastword $(MAKEFILE_LIST)))

# MAKEFLAGS += --no-print-directory

TARGET_DEBUG := debug
TARGET_SPEED := release_speed
TARGET_SIZE := release_size
TARGET ?= $(TARGET_DEBUG)

ASC := asc

ASC_BINDINGS := esm

ASC_CONFIG_FILE := asconfig.json
ASC_COMPILE_SCRIPT := compile_asc.mjs
ASC_COMPILE_SCRIPT_DEP := wasmConfig.mjs

SOURCE_DIR := src
BUILD_DIR := build

ASC_SOURCE_DIR := $(SOURCE_DIR)/asc
ASC_BUILD_DIR := $(BUILD_DIR)/asc

# rwildcard=$(foreach d,$(wildcard $(1:=/*)),$(call rwildcard,$d,$2) $(filter $(subst *,%,$2),$d))

ASC_ALL_SOURCE_FILES := $(shell find src/asc/ -type f \( -name '*.ts' ! -name 'gen_*.ts' \))
# ASC_ALL_SOURCE_FILES := $(wildcard $(ASC_SOURCE_DIR)/**/*.ts)

# ASC_DEP_FILES := $(wildcard $(ASC_SOURCE_DIR)/*.d)
ASC_DEP_FILES := $(ASC_ALL_SOURCE_FILES:.ts=.d)

# modules to build
ASC_MODULES := engine

ASC_SOURCE_FILES := $(ASC_MODULES:%=$(ASC_SOURCE_DIR)/%.ts)
ASC_BUILD_FILES := $(ASC_SOURCE_FILES:$(ASC_SOURCE_DIR)/%.ts=$(ASC_BUILD_DIR)/%.wasm)

# SOURCE_WAT_FILES = $(wildcard $(SOURCE_DIR)/wat/*.wat)

WAT_SOURCE_DIR := src/wat
WAT_BUILD_DIR := build/wat
WAT_SOURCE_FILES := $(wildcard $(WAT_SOURCE_DIR)/*.wat)
WAT_BUILD_FILES := $(WAT_SOURCE_FILES:$(WAT_SOURCE_DIR)/%.wat=$(WAT_BUILD_DIR)/%.wasm)
WAT_2_WASM_FLAGS := --disable-mutable-globals --enable-threads --enable-tail-call
WASM_OPT_FLAGS := --zero-filled-memory --all-features --disable-mutable-globals --disable-gc --disable-exception-handling
WASM_OPT_SPEED:= --converge --dce -O3 $(WASM_OPT_FLAGS)
WASM_OPT_SIZE:= --converge --dce -Oz $(WASM_OPT_FLAGS)
WASM_OPT_DEBUG:= -O --debuginfo $(WASM_OPT_FLAGS)

.PHONY: all build_asc build_wat force clean clean-asc clean-asc-dep clean-wat

all: build_asc

build_flags: force
	@echo '$(TARGET)' | cmp -s - $@ || echo '$(TARGET)' > $@

# **************************************************
# COMPILE ASC
# **************************************************

# @echo 'Asc files compilation terminated.'

build_dep_only: $(ASC_DEP_FILES)
	@echo 'Dependencies file generation terminated.'

build_asc: init_asc_build $(ASC_BUILD_FILES)

init_asc_build:
	@mkdir -p $(ASC_BUILD_DIR)

ifeq (,$(findstring clean,$(MAKECMDGOALS)))
-include $(ASC_DEP_FILES)
endif

## compile with asc from node script
$(ASC_BUILD_DIR)/%.wasm: $(ASC_SOURCE_DIR)/%.ts build_flags $(ASC_COMPILE_SCRIPT) $(ASC_COMPILE_SCRIPT_DEP)
	$(info GEN $@)
	@time node ./compile_asc.mjs $< $@ $(ASC_BINDINGS) $(TARGET)

## compile with asc directly
# $(ASC_BUILD_DIR)/%.wasm: $(ASC_SOURCE_DIR)/%.ts build_flags $(ASC_CONFIG_FILE)
# 	$(info GEN $@)
# 	$(info input $<)
# 	asc --config $(ASC_CONFIG_FILE) $< -o $@ -t $(basename $@).wat -b $(ASC_BINDINGS) --target $(TARGET)

%.d: %.ts
	$(info GEN $@)
	@rm -f $@;
	@node ./genDepList.mjs $< > $@

# **************************************************
# COMPILE WAT
# **************************************************

# not used

build_wat: init_wat_build $(WAT_BUILD_FILES)
	@echo
	@echo 'Wat files compilation terminated.'

init_wat_build:
	@echo
	@echo 'Compiling Wat files...'
	@mkdir -p $(WAT_BUILD_DIR)

$(WAT_BUILD_DIR)/%.wasm: $(WAT_SOURCE_DIR)/%.wat build_flags
	@echo
	$(info GEN $@)
	wat2wasm $< $(WAT_2_WASM_FLAGS) -o $@
ifeq ($(TARGET), $(TARGET_SPEED))
	wasm-opt $@ -o $@ $(WASM_OPT_SPEED)
else ifeq ($(TARGET), $(TARGET_SIZE))
	wasm-opt $@ -o $@ $(WASM_OPT_SIZE)
else
	wasm-opt $@ -o $@ $(WASM_OPT_DEBUG)
endif

clean-asc-dep:
	@echo 'Cleaning asc dependency files...'
	rm -f $(ASC_DEP_FILES)

clean-asc: clean-asc-dep
	rm -rf $(BUILD_DIR)/asc

clean-wat:
	rm -rf $(BUILD_DIR)/wat

clean: clean-asc-dep
	@echo 'Cleaning asc build files...'
	rm -rf $(BUILD_DIR)/

# SOURCE_ASC_PATHS = $(wildcard $(SOURCE_DIR)/asc/*.ts)
# SOURCE_ASC_NAMES = $(notdir $(SOURCE_ASC_PATHS))
# BUILD_ASC_TO_WASM_NAMES = $(SOURCE_ASC_NAMES:.ts=.wasm)
# BUILD_ASC_TO_WASM = $(addprefix $(BUILD_DIR)/asc/, $(BUILD_ASC_TO_WASM_NAMES))
