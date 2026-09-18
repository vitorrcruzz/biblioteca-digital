# Fix missing `:capacitor-cordova-android-plugins` project error

The project is failing to build because `settings.gradle` and other Gradle files reference a sub-project `:capacitor-cordova-android-plugins` whose directory does not exist. This typically happens in Capacitor projects when no Cordova plugins are installed, but the references remain in the Gradle configuration.

## Proposed Changes

### [Root Project](file:///C:/Users/vitor/OneDrive/Documentos/arquivos_diversos/projetos/biblioteca digital/android)

#### [MODIFY] [settings.gradle](file:///C:/Users/vitor/OneDrive/Documentos/arquivos_diversos/projetos/biblioteca digital/android/settings.gradle)
- Remove `include ':capacitor-cordova-android-plugins'` and the corresponding `projectDir` setting.

### [App Module](file:///C:/Users/vitor/OneDrive/Documentos/arquivos_diversos/projetos/biblioteca digital/android/app)

#### [MODIFY] [build.gradle](file:///C:/Users/vitor/OneDrive/Documentos/arquivos_diversos/projetos/biblioteca digital/android/app/build.gradle)
- Remove `implementation project(':capacitor-cordova-android-plugins')`.
- Remove the `flatDir` entry pointing to the non-existent plugin directory.

#### [MODIFY] [capacitor.build.gradle](file:///C:/Users/vitor/OneDrive/Documentos/arquivos_diversos/projetos/biblioteca digital/android/app/capacitor.build.gradle)
- Remove `apply from: "../capacitor-cordova-android-plugins/cordova.variables.gradle"`.

## Verification Plan

### Automated Tests
- Run `./gradlew help` to ensure Gradle can successfully configure the project without errors.
