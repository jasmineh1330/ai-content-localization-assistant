import { Separator } from "@/components/ui/separator";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Settings } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "../ui/scroll-area";
import { toast } from "sonner";
import { UserConfig } from "@/lib/types";

interface ContentConfigProps {
    configOpen: boolean;
    setConfigOpen: (config: boolean) => void;
    userConfig: UserConfig;
    setUserConfig: (config: UserConfig | ((prev: UserConfig) => UserConfig)) => void;
    platformNames: Record<"tiktok" | "linkedin" | "reddit" | "twitter", string>;
}

export const ContentConfig = ({
    configOpen,
    setConfigOpen,
    userConfig,
    setUserConfig,
    platformNames
}: ContentConfigProps) => {

    const handleSaveConfig = () => {
        localStorage.setItem("post-config", JSON.stringify(userConfig))
        setConfigOpen(false);
        toast.success("Your post configurations saved successfully.")
    }

    return (
        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                    <Settings className="w-4 h-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto dark:bg-gray-800">
                <DialogHeader>
                    <DialogTitle className="dark:text-white">Content Configuration</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                    <div className="flex flex-col space-y-4 px-4">
                        {/* Left Column - Knowledge Base */}
                        <div className="space-y-1">
                                <Label htmlFor="knowledge-base" className="dark:text-gray-200 text-base font-medium">
                                产品事实库
                            </Label>
                            <Textarea
                                id="knowledge-base"
                                placeholder="粘贴产品的官方参数、市场版本、免责声明和可引用来源，也可以通过多模态互动从图片/视频中提取。不要填写未经确认的价格或促销信息。"
                                value={userConfig.knowledgeBase}
                                onChange={(e) => setUserConfig((prev) => ({ ...prev, knowledgeBase: e.target.value }))}
                                className="h-48 resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>

                        {/* Right Column - Other Settings */}
                        <div className="space-y-6">
                            {/* Basic Settings */}
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Label htmlFor="target-market" className="dark:text-gray-200">
                                        目标市场
                                    </Label>
                                    <Select
                                        value={userConfig.targetMarket || "United States"}
                                        onValueChange={(value) => setUserConfig((prev) => ({ ...prev, targetMarket: value }))}
                                    >
                                        <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                                            <SelectItem value="United States">United States（美国）</SelectItem>
                                            <SelectItem value="United Kingdom">United Kingdom（英国）</SelectItem>
                                            <SelectItem value="Canada">Canada（加拿大）</SelectItem>
                                            <SelectItem value="Australia">Australia（澳大利亚）</SelectItem>
                                            <SelectItem value="Germany">Germany（德国）</SelectItem>
                                            <SelectItem value="France">France（法国）</SelectItem>
                                            <SelectItem value="Spain">Spain（西班牙）</SelectItem>
                                            <SelectItem value="Italy">Italy（意大利）</SelectItem>
                                            <SelectItem value="Brazil">Brazil（巴西）</SelectItem>
                                            <SelectItem value="Mexico">Mexico（墨西哥）</SelectItem>
                                            <SelectItem value="Saudi Arabia">Saudi Arabia（沙特）</SelectItem>
                                            <SelectItem value="UAE">UAE（阿联酋）</SelectItem>
                                            <SelectItem value="Turkey">Turkey（土耳其）</SelectItem>
                                            <SelectItem value="India">India（印度）</SelectItem>
                                            <SelectItem value="Indonesia">Indonesia（印尼）</SelectItem>
                                            <SelectItem value="Philippines">Philippines（菲律宾）</SelectItem>
                                            <SelectItem value="Vietnam">Vietnam（越南）</SelectItem>
                                            <SelectItem value="Thailand">Thailand（泰国）</SelectItem>
                                            <SelectItem value="Japan">Japan（日本）</SelectItem>
                                            <SelectItem value="South Korea">South Korea（韩国）</SelectItem>
                                            <SelectItem value="Nigeria">Nigeria（尼日利亚）</SelectItem>
                                            <SelectItem value="Egypt">Egypt（埃及）</SelectItem>
                                            <SelectItem value="Kenya">Kenya（肯尼亚）</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="topic" className="dark:text-gray-200">
                                        内容目标 / 卖点
                                    </Label>
                                    <Input
                                        id="topic"
                                        placeholder="例如：夜景人像、年轻摄影爱好者、新品认知"
                                        value={userConfig.topic}
                                        onChange={(e) => setUserConfig((prev) => ({ ...prev, topic: e.target.value }))}
                                        className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="tone" className="dark:text-gray-200">
                                        品牌与创作者语气
                                        </Label>
                                        <Select
                                            value={userConfig.tone}
                                            onValueChange={(value) => setUserConfig((prev) => ({ ...prev, tone: value }))}
                                        >
                                            <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                                                <SelectItem value="professional">Professional</SelectItem>
                                                <SelectItem value="casual">Casual</SelectItem>
                                                <SelectItem value="friendly">Friendly</SelectItem>
                                                <SelectItem value="authoritative">Authoritative</SelectItem>
                                                <SelectItem value="humorous">Humorous</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="post-length" className="dark:text-gray-200">
                                            Post Length
                                        </Label>
                                        <Select
                                            value={userConfig.postLength}
                                            onValueChange={(value) => setUserConfig((prev) => ({ ...prev, postLength: value }))}
                                        >
                                            <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                                                <SelectItem value="low">Low (50-100 words)</SelectItem>
                                                <SelectItem value="medium">Medium (100-200 words)</SelectItem>
                                                <SelectItem value="high">High (200-300 words)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="target-audience" className="dark:text-gray-200">
                                        目标受众
                                    </Label>
                                    <Input
                                        id="target-audience"
                                        placeholder="例如：目标市场的年轻摄影爱好者"
                                        value={userConfig.targetAudience}
                                        onChange={(e) => setUserConfig((prev) => ({ ...prev, targetAudience: e.target.value }))}
                                        className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="banned-phrases" className="dark:text-gray-200">
                                        禁用/高风险表达
                                    </Label>
                                    <Input
                                        id="banned-phrases"
                                        placeholder="例如：best in the market, waterproof, never charge again"
                                        value={userConfig.bannedPhrases || ""}
                                        onChange={(e) => setUserConfig((prev) => ({ ...prev, bannedPhrases: e.target.value }))}
                                        className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                            </div>

                            <Separator className="dark:bg-gray-600" />

                            {/* Posts per Platform with Sliders */}
                            <div>
                                <Label className="text-base font-medium dark:text-gray-200">Posts per Platform</Label>
                                <div className="space-y-4 mt-3">
                                    {(["tiktok", "linkedin", "reddit", "twitter"] as const).map((platform) => (
                                        <div key={platform} className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-sm dark:text-gray-300">
                                                    {platformNames[platform]}
                                                </Label>
                                                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                                    {userConfig.postsPerPlatform[platform]} posts
                                                </span>
                                            </div>
                                            <Slider
                                                value={[userConfig.postsPerPlatform[platform]]}
                                                onValueChange={(value) =>
                                                    setUserConfig((prev) => ({
                                                        ...prev,
                                                        postsPerPlatform: {
                                                            ...prev.postsPerPlatform,
                                                            [platform]: value[0],
                                                        },
                                                    }))
                                                }
                                                max={10}
                                                min={1}
                                                step={1}
                                                className="w-full"
                                            />
                                            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                                <span>1</span>
                                                <span>10</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Save Button - Centered at bottom */}
                    <div className="flex justify-center pt-6">
                        <Button onClick={handleSaveConfig} className="w-48 cursor-pointer">
                            Save Configuration
                        </Button>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
