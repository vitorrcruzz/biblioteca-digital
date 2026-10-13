import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";

window.CapacitorGoogleAuth = { Capacitor, FirebaseAuthentication };
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
window.LibraryFiles = { Capacitor, Filesystem, Directory, Share };
