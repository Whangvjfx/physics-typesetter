import UIKit
import Photos
import Capacitor

@objc(PhotoSaverPlugin)
public class PhotoSaverPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PhotoSaverPlugin"
    public let jsName = "PhotoSaver"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "savePhoto", returnType: CAPPluginReturnPromise)
    ]

    @objc func savePhoto(_ call: CAPPluginCall) {
        guard let dataString = call.getString("data") else {
            call.reject("Must provide image data")
            return
        }

        let cleanBase64 = dataString.contains(",") ? String(dataString.split(separator: ",")[1]) : dataString
        guard let imageData = Data(base64Encoded: cleanBase64), let image = UIImage(data: imageData) else {
            call.reject("Invalid image data")
            return
        }

        if #available(iOS 14, *) {
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { [weak self] status in
                self?.handleAuthStatus(status, image: image, call: call)
            }
        } else {
            PHPhotoLibrary.requestAuthorization { [weak self] status in
                self?.handleAuthStatus(status, image: image, call: call)
            }
        }
    }

    private func handleAuthStatus(_ status: PHAuthorizationStatus, image: UIImage, call: CAPPluginCall) {
        if status == .authorized || status == .limited {
            DispatchQueue.main.async {
                UIImageWriteToSavedPhotosAlbum(image, self, #selector(self.image(_:didFinishSavingWithError:contextInfo:)), nil)
                call.resolve(["success": true])
            }
        } else {
            call.reject("请在 iPhone「设置」中开启本应用的「照片写入」权限")
        }
    }

    @objc func image(_ image: UIImage, didFinishSavingWithError error: Error?, contextInfo: UnsafeRawPointer?) {
        if let error = error {
            print("Photo save error: \(error.localizedDescription)")
        } else {
            print("Photo successfully saved to Camera Roll")
        }
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
