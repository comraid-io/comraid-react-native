require "json"

unless defined?(install_modules_dependencies)
  local_helper = File.join(__dir__, "node_modules/react-native/scripts/react_native_pods.rb")
  consumer_helper = File.expand_path("../react-native/scripts/react_native_pods.rb", __dir__)
  require File.exist?(local_helper) ? local_helper : consumer_helper
end

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |spec|
  spec.name = "ReactNativeComraid"
  spec.version = package["version"]
  spec.summary = package["description"]
  spec.homepage = package["homepage"]
  spec.license = package["license"]
  spec.authors = package["author"]
  spec.platforms = { :ios => "15.0" }
  spec.source = {
    :git => "https://github.com/comraid-io/comraid-react-native.git",
    :tag => spec.version.to_s,
  }
  spec.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  spec.private_header_files = "ios/**/*.h"
  spec.dependency "ComRaid", "~> 0.1.0"
  spec.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES",
    "CLANG_ENABLE_MODULES" => "YES",
    "OTHER_CPLUSPLUSFLAGS" => "$(inherited) -fcxx-modules",
  }

  install_modules_dependencies(spec)
end
