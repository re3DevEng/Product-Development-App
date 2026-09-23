using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

internal static class ServerLauncher
{
    private const string OriginalRoot = @"C:\Users\draft\OneDrive\Documents\Dom Files\Product Development App";

    [STAThread]
    private static int Main(string[] args)
    {
        bool checkOnly = Array.IndexOf(args, "--check") >= 0;
        bool ownsMutex;
        using (var mutex = new Mutex(true, "Local\\Re3DProductDevelopmentLauncher", out ownsMutex))
        {
            if (!ownsMutex) return 0;
            try
            {
                string root = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
                if (!File.Exists(Path.Combine(root, "package.json"))) root = OriginalRoot;
                string next = Path.Combine(root, "node_modules", "next", "dist", "bin", "next");
                if (!File.Exists(next) || !File.Exists(Path.Combine(root, ".next", "BUILD_ID")))
                    throw new Exception("The app's built files are missing. Build the app before using this launcher.");

                string address = NetworkAddress();
                string url = "http://" + address + ":3000/";
                if (!IsApp(url))
                {
                    if (checkOnly) throw new Exception("The app is not responding at " + url);
                    foreach (var endpoint in IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners())
                        if (endpoint.Port == 3000)
                            throw new Exception("Port 3000 is already in use, but the app is not available at " + url + ". Close the existing server and try again.");

                    string node = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe");
                    if (!File.Exists(node)) throw new Exception("Node.js was not found. This launcher requires the app's Node.js installation.");
                    var start = new ProcessStartInfo(node, "\"" + next + "\" start --hostname 0.0.0.0 --port 3000");
                    start.WorkingDirectory = root;
                    start.UseShellExecute = false;
                    start.CreateNoWindow = true;
                    using (var server = Process.Start(start))
                    {
                        bool ready = false;
                        for (int attempt = 0; attempt < 60; attempt++)
                        {
                            if (IsApp(url)) { ready = true; break; }
                            if (server.HasExited) throw new Exception("The server stopped during startup (exit code " + server.ExitCode + "). The app may need to be rebuilt.");
                            Thread.Sleep(500);
                        }
                        if (!ready) throw new Exception("The server started but has not responded yet. Try opening " + url + " shortly.");
                    }
                }
                if (!checkOnly) Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                return 0;
            }
            catch (Exception ex)
            {
                if (!checkOnly) MessageBox.Show(ex.Message, "Product Development Server", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
            finally { mutex.ReleaseMutex(); }
        }
    }

    private static string NetworkAddress()
    {
        foreach (var adapter in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (adapter.OperationalStatus != OperationalStatus.Up ||
                (adapter.NetworkInterfaceType != NetworkInterfaceType.Wireless80211 &&
                 adapter.NetworkInterfaceType != NetworkInterfaceType.Ethernet)) continue;
            var properties = adapter.GetIPProperties();
            bool gateway = false;
            foreach (var item in properties.GatewayAddresses)
                if (item.Address.AddressFamily == AddressFamily.InterNetwork && !item.Address.Equals(IPAddress.Any)) gateway = true;
            if (!gateway) continue;
            foreach (var item in properties.UnicastAddresses)
                if (item.Address.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(item.Address) && !item.Address.ToString().StartsWith("169.254."))
                    return item.Address.ToString();
        }
        throw new Exception("No active local network connection was found. Connect to Wi-Fi or Ethernet and try again.");
    }

    private static bool IsApp(string url)
    {
        try
        {
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Timeout = 1500;
            request.ReadWriteTimeout = 1500;
            request.Proxy = null;
            using (var response = request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
                return reader.ReadToEnd().Contains("<title>Product Development | re:3D</title>");
        }
        catch { return false; }
    }
}
