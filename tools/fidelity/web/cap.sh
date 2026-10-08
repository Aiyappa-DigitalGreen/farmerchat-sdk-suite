#!/bin/sh
# usage: cap.sh name  → android/<name>.png + ui dump of visible texts
export ANDROID_SERIAL=emulator-5554
D=$(dirname "$0"); mkdir -p "$D/android"
adb exec-out screencap -p > "$D/android/$1.png"
adb shell uiautomator dump /sdcard/u.xml >/dev/null 2>&1
adb shell cat /sdcard/u.xml | grep -oE '(text|content-desc)="[^"]+"[^>]*bounds="[^"]*"' | sed -E 's/ resource-id.*bounds=/ @/' > "$D/android/$1.txt"
