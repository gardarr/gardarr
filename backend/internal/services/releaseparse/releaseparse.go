// Package releaseparse extracts useful, deterministic metadata from scene-style
// release names. It deliberately has no dependencies on infrastructure so it
// can be used before a torrent has been created.
package releaseparse

import (
	"html"
	"regexp"
	"strings"
)

type Confidence string

const (
	ConfidenceLow    Confidence = "low"
	ConfidenceMedium Confidence = "medium"
	ConfidenceHigh   Confidence = "high"
)

type ReleaseType string

const (
	ReleaseTypeUnknown   ReleaseType = "unknown"
	ReleaseTypeMovie     ReleaseType = "movie"
	ReleaseTypeSeries    ReleaseType = "series"
	ReleaseTypeOS        ReleaseType = "os"
	ReleaseTypeGame      ReleaseType = "game"
	ReleaseTypeBook      ReleaseType = "book"
	ReleaseTypeMusic     ReleaseType = "music"
	ReleaseTypeSoftware  ReleaseType = "software"
	ReleaseTypeAudiobook ReleaseType = "audiobook"
	ReleaseTypeComic     ReleaseType = "comic"
	ReleaseTypeCourse    ReleaseType = "course"
	ReleaseTypeDataset   ReleaseType = "dataset"
	ReleaseTypeROM       ReleaseType = "rom"
	ReleaseTypePodcast   ReleaseType = "podcast"
	ReleaseTypeAnime     ReleaseType = "anime"
)

// Result is intentionally a transport-friendly value: the API can return it
// directly and callers can derive a search query, tags, and a friendly name
// without reparsing the original string.
type Result struct {
	Raw          string      `json:"raw"`
	Title        string      `json:"title,omitempty"`
	Year         string      `json:"year,omitempty"`
	Season       string      `json:"season,omitempty"`
	Episode      string      `json:"episode,omitempty"`
	Resolution   string      `json:"resolution,omitempty"`
	Source       string      `json:"source,omitempty"`
	Codec        string      `json:"codec,omitempty"`
	Audio        string      `json:"audio,omitempty"`
	Language     string      `json:"language,omitempty"`
	Edition      string      `json:"edition,omitempty"`
	Group        string      `json:"group,omitempty"`
	Distro       string      `json:"distro,omitempty"`
	Platform     string      `json:"platform,omitempty"`
	Format       string      `json:"format,omitempty"`
	Version      string      `json:"version,omitempty"`
	Architecture string      `json:"architecture,omitempty"`
	Volume       string      `json:"volume,omitempty"`
	Issue        string      `json:"issue,omitempty"`
	HDR          string      `json:"hdr,omitempty"`
	Region       string      `json:"region,omitempty"`
	Provider     string      `json:"provider,omitempty"`
	Package      string      `json:"package,omitempty"`
	Type         ReleaseType `json:"type"`
	Confidence   Confidence  `json:"confidence"`
}

var (
	separatorRE       = regexp.MustCompile(`[._\[\]{}()]+`)
	spaceRE           = regexp.MustCompile(`\s+`)
	yearRE            = regexp.MustCompile(`\b(?:19\d{2}|20[0-4]\d)\b`)
	seasonRE          = regexp.MustCompile(`(?i)\bS(\d{1,2})(?:E(\d{1,3}))?\b`)
	xEpisodeRE        = regexp.MustCompile(`(?i)\b(\d{1,2})x(\d{1,3})\b`)
	seasonWordRE      = regexp.MustCompile(`(?i)\bseason\s+(\d{1,2})\b`)
	resolutionRE      = regexp.MustCompile(`(?i)\b(2160p|1440p|1080p|720p|576p|480p|4k|8k)\b`)
	sourceRE          = regexp.MustCompile(`(?i)\b(web[ -]?(?:dl|rip)|blu[ -]?ray|bdrip|brrip|dvdrip|hdtv|uhd|remux)\b`)
	codecRE           = regexp.MustCompile(`(?i)\b(x265|x264|h\.?265|h\.?264|hevc|av1|avc)\b`)
	audioRE           = regexp.MustCompile(`(?i)\b(dts[ -]?hd|dts|truehd|atmos|eac3|ddp|ac3|aac(?:[ .-]?[257]\.1)?)\b`)
	languageRE        = regexp.MustCompile(`(?i)\b(multi|dual(?:[ -]?audio)?|dubbed)\b`)
	editionRE         = regexp.MustCompile(`(?i)\b(director[' ]?s[ -]?cut|extended|unrated|proper|repack|remastered|anniversary|deluxe|collector(?:'?s)?(?:\s+edition)?|criterion|theatrical|ultimate)\b`)
	distroRE          = regexp.MustCompile(`(?i)\b(ubuntu|debian|fedora|arch(?:\s*linux)?|linux\s+mint|opensuse|kali|windows|macos)\b`)
	platformRE        = regexp.MustCompile(`(?i)\b(pc|windows|linux|macos|ps[345]|playstation[ -]?[345]|xbox(?:[ -]?(?:one|series))?|switch|nes|snes|n64|gamecube|wii(?:[ -]?u)?|game[ -]?boy(?:[ -]?advance)?|genesis|dreamcast|psp|ps[ -]?vita|arcade|mame)\b`)
	formatRE          = regexp.MustCompile(`(?i)\b(iso|epub|mobi|azw3|pdf|cbz|cbr|flac|mp3|ogg|m4a|wav|m4b|aaxc?|dmg|pkg|msi|exe|apk|appimage|deb|rpm|csv|parquet|jsonl|sqlite|hdf5|h5|arrow|safetensors|gguf)\b`)
	versionRE         = regexp.MustCompile(`(?i)\bv?(\d+(?:\.\d+){1,3})\b`)
	versionMarkerRE   = regexp.MustCompile(`(?i)\bv?\d+(?:[.\s]\d+){1,3}\b`)
	architectureRE    = regexp.MustCompile(`(?i)\b(x86[_ -]?64|x64|amd64|aarch64|arm64|i[3-6]86)\b`)
	volumeRE          = regexp.MustCompile(`(?i)\b(?:vol(?:ume)?|book)\s*(\d{1,3})\b`)
	issueRE           = regexp.MustCompile(`(?i)\b(?:issue|chapter|ch)\s*(\d{1,4})\b`)
	hdrRE             = regexp.MustCompile(`(?i)\b(hdr10\+|hdr10|hdr|dolby\s+vision|dv)`)
	regionRE          = regexp.MustCompile(`\b(USA|EUR|EU|JPN|JP|JAPAN|WORLD|NTSC|PAL)\b`)
	providerRE        = regexp.MustCompile(`(?i)\b(udemy|coursera|masterclass|pluralsight|skillshare|linkedin\s+learning|kaggle|hugging\s*face|audible|steam|gog|epic)\b`)
	packageRE         = regexp.MustCompile(`(?i)\b(complete|collection|season\s+pack|dlc|update|expansion|bonus|disc\s*\d+)\b`)
	gameMarkerRE      = regexp.MustCompile(`(?i)\b(?:gog|steam|epic|fitgirl|dodi|rune|tenoke|pc|ps[345]|xbox|switch)\b`)
	softwareMarkerRE  = regexp.MustCompile(`(?i)\b(?:appimage|installer|portable|keygen|serial)\b`)
	audiobookMarkerRE = regexp.MustCompile(`(?i)\b(?:audiobook|audio\s*book|audible)\b`)
	comicMarkerRE     = regexp.MustCompile(`(?i)\b(?:comic|comics|manga|manhwa|manhua|graphic\s+novel)\b`)
	courseMarkerRE    = regexp.MustCompile(`(?i)\b(?:udemy|coursera|masterclass|pluralsight|skillshare|linkedin\s+learning|tutorial)\b`)
	datasetMarkerRE   = regexp.MustCompile(`(?i)\b(?:dataset|data\s*set|kaggle|hugging\s*face|model\s*weights)\b`)
	romMarkerRE       = regexp.MustCompile(`(?i)\b(?:rom|no-intro|redump|goodtools)\b`)
	romPlatformRE     = regexp.MustCompile(`(?i)\b(?:nes|snes|n64|gamecube|wii(?:[ -]?u)?|game[ -]?boy(?:[ -]?advance)?|genesis|dreamcast|psp|ps[ -]?vita|arcade|mame)\b`)
	podcastMarkerRE   = regexp.MustCompile(`(?i)\bpodcast\b`)
	podcastEpisodeRE  = regexp.MustCompile(`(?i)\b(?:episode|ep)\s*(\d{1,4})\b`)
	animeMarkerRE     = regexp.MustCompile(`(?i)\b(?:anime|fansub|anidb|crunchyroll)\b`)
	groupRE           = regexp.MustCompile(`-([A-Za-z0-9][A-Za-z0-9_-]{1,})\s*$`)
)

// Parse returns partial data for imperfect names. Consumers should use
// Confidence to decide whether to pre-fill user-facing fields.
func Parse(raw string) Result {
	result := Result{Raw: raw, Type: ReleaseTypeMovie, Confidence: ConfidenceLow}
	decodedRaw := html.UnescapeString(raw)
	input := normalize(decodedRaw)
	if input == "" {
		return result
	}

	if match := groupRE.FindStringSubmatch(strings.TrimSpace(decodedRaw)); len(match) == 2 {
		result.Group = match[1]
	}
	if match := yearRE.FindString(input); match != "" {
		result.Year = match
	}
	if match := seasonRE.FindStringSubmatch(input); len(match) > 1 {
		result.Season, result.Episode, result.Type = match[1], match[2], ReleaseTypeSeries
	} else if match := xEpisodeRE.FindStringSubmatch(input); len(match) == 3 {
		result.Season, result.Episode, result.Type = match[1], match[2], ReleaseTypeSeries
	} else if match := seasonWordRE.FindStringSubmatch(input); len(match) == 2 {
		result.Season, result.Type = match[1], ReleaseTypeSeries
	}
	if match := podcastEpisodeRE.FindStringSubmatch(input); result.Episode == "" && len(match) == 2 {
		result.Episode = match[1]
	}
	result.Resolution = canonical(resolutionRE.FindString(input))
	result.Source = canonicalSource(sourceRE.FindString(input))
	result.Codec = canonicalCodec(codecRE.FindString(input))
	result.Audio = canonical(audioRE.FindString(input))
	result.Language = canonical(languageRE.FindString(input))
	result.Edition = canonical(editionRE.FindString(input))
	result.Distro = canonicalDistro(distroRE.FindString(input))
	result.Platform = canonicalPlatform(platformRE.FindString(input))
	result.Format = canonical(formatRE.FindString(input))
	result.Architecture = canonicalArchitecture(architectureRE.FindString(input))
	if match := versionRE.FindStringSubmatch(decodedRaw); len(match) == 2 {
		result.Version = match[1]
	}
	if match := volumeRE.FindStringSubmatch(input); len(match) == 2 {
		result.Volume = match[1]
	}
	if match := issueRE.FindStringSubmatch(input); len(match) == 2 {
		result.Issue = match[1]
	}
	result.HDR = canonicalHDR(hdrRE.FindString(input))
	result.Region = canonicalRegion(regionRE.FindString(decodedRaw))
	result.Provider = canonicalProvider(providerRE.FindString(input))
	result.Package = canonical(packageRE.FindString(input))

	result.Type = detectType(result, input)
	if result.Type != ReleaseTypeOS && result.Type != ReleaseTypeGame && result.Type != ReleaseTypeSoftware {
		result.Version = ""
	}

	result.Title = titleBeforeMetadata(input)
	if result.Type == ReleaseTypeOS {
		result.Title = displayDistro(result.Distro)
	}
	if result.Title == "" {
		return result
	}

	markers := 0
	for _, value := range []string{result.Year, result.Season, result.Episode, result.Resolution, result.Source, result.Codec, result.Audio, result.Language, result.Edition, result.Distro, result.Platform, result.Format, result.Version, result.Architecture, result.Volume, result.Issue, result.HDR, result.Region, result.Provider, result.Package} {
		if value != "" {
			markers++
		}
	}
	if markers >= 1 {
		result.Confidence = ConfidenceHigh
	} else if len([]rune(result.Title)) >= 2 {
		result.Confidence = ConfidenceMedium
	}
	return result
}

func (r Result) SearchQuery() string {
	if r.Title == "" {
		return strings.TrimSpace(r.Raw)
	}
	if r.Year != "" {
		return r.Title + " " + r.Year
	}
	return r.Title
}

func (r Result) DisplayName() string {
	if r.Title == "" {
		return ""
	}
	if r.Year != "" {
		return r.Title + " (" + r.Year + ")"
	}
	if r.Type == ReleaseTypeOS && r.Version != "" {
		return r.Title + " " + r.Version
	}
	return r.Title
}

func (r Result) SuggestedTags() []string {
	tags := make([]string, 0, 12)
	add := func(scope, value string) {
		if value != "" {
			tags = append(tags, scope+"::"+strings.ToLower(value))
		}
	}
	add("quality", r.Resolution)
	add("source", r.Source)
	add("codec", r.Codec)
	add("audio", r.Audio)
	add("language", r.Language)
	add("edition", r.Edition)
	add("hdr", r.HDR)
	add("season", r.Season)
	add("episode", r.Episode)
	if r.Type != ReleaseTypeMovie && r.Type != ReleaseTypeSeries && r.Type != ReleaseTypeUnknown {
		add("type", string(r.Type))
	}
	add("distro", r.Distro)
	add("platform", r.Platform)
	add("format", r.Format)
	add("architecture", r.Architecture)
	add("version", r.Version)
	add("volume", r.Volume)
	add("issue", r.Issue)
	add("region", r.Region)
	add("provider", r.Provider)
	add("package", r.Package)
	return tags
}

func normalize(raw string) string {
	value := separatorRE.ReplaceAllString(strings.TrimSpace(raw), " ")
	value = strings.ReplaceAll(value, "_", " ")
	return spaceRE.ReplaceAllString(value, " ")
}

func titleBeforeMetadata(input string) string {
	positions := make([]int, 0, 8)
	for _, re := range []*regexp.Regexp{yearRE, seasonRE, xEpisodeRE, seasonWordRE, podcastEpisodeRE, resolutionRE, sourceRE, codecRE, audioRE, languageRE, editionRE, hdrRE, formatRE, versionMarkerRE, gameMarkerRE, audiobookMarkerRE, comicMarkerRE, courseMarkerRE, datasetMarkerRE, romMarkerRE, romPlatformRE, podcastMarkerRE, animeMarkerRE, volumeRE, issueRE, regionRE, providerRE, packageRE} {
		if index := re.FindStringIndex(input); index != nil {
			positions = append(positions, index[0])
		}
	}
	cut := len(input)
	for _, position := range positions {
		if position < cut {
			cut = position
		}
	}
	return strings.Trim(strings.TrimSpace(input[:cut]), "- ")
}

func canonical(value string) string { return strings.TrimSpace(strings.ToLower(value)) }
func canonicalSource(value string) string {
	value = strings.ReplaceAll(canonical(value), " ", "")
	value = strings.ReplaceAll(value, "-", "")
	if value == "bluray" {
		return "bluray"
	}
	if value == "webdl" {
		return "web-dl"
	}
	if value == "webrip" {
		return "webrip"
	}
	return value
}
func canonicalCodec(value string) string {
	value = strings.ReplaceAll(canonical(value), ".", "")
	if value == "h265" {
		return "hevc"
	}
	return value
}

func detectType(result Result, input string) ReleaseType {
	if isDataset(result.Format) || datasetMarkerRE.MatchString(input) {
		return ReleaseTypeDataset
	}
	if courseMarkerRE.MatchString(input) {
		return ReleaseTypeCourse
	}
	if result.Format == "m4b" || result.Format == "aax" || result.Format == "aaxc" || audiobookMarkerRE.MatchString(input) {
		return ReleaseTypeAudiobook
	}
	if result.Format == "cbz" || result.Format == "cbr" || comicMarkerRE.MatchString(input) {
		return ReleaseTypeComic
	}
	if romMarkerRE.MatchString(input) || romPlatformRE.MatchString(input) {
		return ReleaseTypeROM
	}
	if isSoftwarePackage(result.Format) || softwareMarkerRE.MatchString(input) {
		return ReleaseTypeSoftware
	}
	if result.Distro != "" {
		return ReleaseTypeOS
	}
	if podcastMarkerRE.MatchString(input) || (result.Episode != "" && isAudioFormat(result.Format)) {
		return ReleaseTypePodcast
	}
	if animeMarkerRE.MatchString(input) {
		return ReleaseTypeAnime
	}
	if result.Format == "epub" || result.Format == "mobi" || result.Format == "azw3" || result.Format == "pdf" || result.Format == "cbz" || result.Format == "cbr" || result.Volume != "" {
		return ReleaseTypeBook
	}
	if isAudioFormat(result.Format) {
		return ReleaseTypeMusic
	}
	if result.Platform != "" || gameMarkerRE.MatchString(input) {
		return ReleaseTypeGame
	}
	if result.Season != "" || result.Episode != "" {
		return ReleaseTypeSeries
	}
	return ReleaseTypeMovie
}

func isAudioFormat(format string) bool {
	return format == "flac" || format == "mp3" || format == "ogg" || format == "m4a" || format == "wav"
}

func isSoftwarePackage(format string) bool {
	return format == "dmg" || format == "pkg" || format == "msi" || format == "exe" || format == "apk" || format == "appimage" || format == "deb" || format == "rpm"
}

func isDataset(format string) bool {
	return format == "csv" || format == "parquet" || format == "jsonl" || format == "sqlite" || format == "hdf5" || format == "h5" || format == "arrow" || format == "safetensors" || format == "gguf"
}

func canonicalDistro(value string) string {
	value = canonical(value)
	if value == "archlinux" || value == "arch linux" {
		return "arch"
	}
	return value
}

func canonicalPlatform(value string) string {
	value = strings.ReplaceAll(canonical(value), " ", "")
	value = strings.ReplaceAll(value, "-", "")
	if strings.HasPrefix(value, "playstation") {
		return "ps" + value[len("playstation"):]
	}
	return value
}

func canonicalArchitecture(value string) string {
	value = canonical(value)
	if value == "x86 64" || value == "x86-64" || value == "x64" || value == "amd64" {
		return "x86_64"
	}
	return value
}

func canonicalHDR(value string) string {
	value = canonical(value)
	if value == "dolby vision" {
		return "dolby-vision"
	}
	return value
}

func canonicalRegion(value string) string {
	switch canonical(value) {
	case "us", "usa":
		return "usa"
	case "eu", "eur":
		return "eu"
	case "jp", "jpn", "japan":
		return "japan"
	default:
		return canonical(value)
	}
}

func canonicalProvider(value string) string {
	value = canonical(value)
	if value == "huggingface" {
		return "hugging face"
	}
	return value
}

func displayDistro(value string) string {
	switch value {
	case "macos":
		return "macOS"
	case "opensuse":
		return "openSUSE"
	case "linux mint":
		return "Linux Mint"
	case "":
		return ""
	default:
		return strings.ToUpper(value[:1]) + value[1:]
	}
}
