#!/bin/sh
# qemu wrapper for the 32-bit amxxpc compiler.
#
# The real binary is amxxpc.bin in the same directory. amxxpc32.so must
# be alongside it for the dlopen() inside amxxpc to succeed.
#
# qemu-i386-static emulates a 32-bit x86 CPU + Linux kernel in userspace.
# This is needed because many cloud kernels (Koyeb free tier included)
# ship with CONFIG_IA32_EMULATION disabled, so 32-bit ELFs cannot be
# exec()'d directly. qemu makes the compiler work on any x86_64 host.
#
# -L / sets the qemu "interp prefix" to the host root, so the emulated
# 32-bit guest can find the 32-bit libraries we installed at the standard
# Debian paths (/lib/i386-linux-gnu, /usr/lib/i386-linux-gnu).
#
# amxxpc uses cwd-relative dlopen("./amxxpc32.so") first and falls back
# to library-path search for "amxxpc32.so". The Dockerfile sets
# LD_LIBRARY_PATH=/usr/local/lib/amxx, so the fallback resolves correctly
# regardless of the caller cwd.

exec /usr/bin/qemu-i386-static \
    -L / \
    /usr/local/lib/amxx/amxxpc.bin "$@"
