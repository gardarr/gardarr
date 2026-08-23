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
	languageRE        = regexp.MustCompile(`(?i)\b(multi|dual(?:[ -]?audio)?|dubbed|subbed|legendado|dublado|pt[ -]?br|latino|castellano|vostfr|itasub|ita|french|german|spanish|russian|korean|japanese)\b`)
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
	fansubBracketRE   = regexp.MustCompile(`^\[([A-Za-z0-9][A-Za-z0-9_ .'-]{1,24})\]\s*`)
	animeEpisodeRE    = regexp.MustCompile(`(?i)\s-\s(\d{1,3})(?:\s|\[|\(|$)`)
	groupRE           = regexp.MustCompile(`-([A-Za-z0-9][A-Za-z0-9_-]{1,})\s*$`)
	videoExtensionRE  = regexp.MustCompile(`(?i)\.(mkv|mp4|avi|mov|wmv|webm|ts|m2ts|flv|vob|mpe?g|m4v)$`)
)

// weakConfidenceFields carry a real but ambiguous signal on their own (a bare
// year, a language marker, a region code can all appear coincidentally), so
// a single one of them is not enough to call a parse "high confidence".
func weakConfidenceFields(r Result) []string {
	return []string{r.Year, r.Language, r.Region}
}

// strongConfidenceFields are vocabulary that is very unlikely to appear by
// coincidence (resolution, codec, format, ...); any one of them is enough to
// trust the rest of the parse.
func strongConfidenceFields(r Result) []string {
	return []string{
		r.Season, r.Episode, r.Resolution, r.Source, r.Codec, r.Audio, r.Edition,
		r.Distro, r.Platform, r.Format, r.Version, r.Architecture, r.Volume,
		r.Issue, r.HDR, r.Provider, r.Package,
	}
}

// Parse returns partial data for imperfect names. Consumers should use
// Confidence to decide whether to pre-fill user-facing fields.
func Parse(raw string) Result {
	result := Result{Raw: raw, Type: ReleaseTypeMovie, Confidence: ConfidenceLow}
	decodedRaw := html.UnescapeString(raw)
	trimmedRaw := strings.TrimSpace(decodedRaw)

	trimmedRaw, fansubGroup, hasFansubBracket := stripFansubBracket(trimmedRaw)

	input := normalize(trimmedRaw)
	if input == "" {
		return result
	}

	result.Group = extractGroup(decodedRaw, fansubGroup)
	if match := yearRE.FindString(input); match != "" {
		result.Year = match
	}
	result.Season, result.Episode = extractSeasonEpisode(input)

	result.Resolution = canonical(resolutionRE.FindString(input))
	result.Source = canonicalSource(sourceRE.FindString(input))
	result.Codec = canonicalCodec(codecRE.FindString(input))
	hasVideoSignal := result.Resolution != "" || result.Source != "" || result.Codec != "" || videoExtensionRE.MatchString(trimmedRaw)
	applyWeakNumberMarkers(&result, input, hasVideoSignal)

	result.Audio = canonical(audioRE.FindString(input))
	result.Language = canonicalLanguage(languageRE.FindString(input))
	result.Edition = canonical(editionRE.FindString(input))
	result.Distro = canonicalDistro(distroRE.FindString(input))
	result.Platform = canonicalPlatform(platformRE.FindString(input))
	result.Format = canonical(formatRE.FindString(input))
	result.Architecture = canonicalArchitecture(architectureRE.FindString(input))
	if match := versionRE.FindStringSubmatch(decodedRaw); len(match) == 2 {
		result.Version = match[1]
	}
	result.HDR = canonicalHDR(hdrRE.FindString(input))
	result.Region = canonicalRegion(regionRE.FindString(decodedRaw))
	result.Provider = canonicalProvider(providerRE.FindString(input))
	result.Package = canonical(packageRE.FindString(input))

	isAnimeSignal, episode := extractAnimeEpisode(input, hasFansubBracket, result.Episode)
	result.Episode = episode

	result.Type = detectType(result, input, isAnimeSignal)
	result = withVersionCleared(result)
	result.Title = finalizeTitle(result, input, hasVideoSignal)
	if result.Title == "" {
		return result
	}

	result.Confidence = computeConfidence(result)
	return result
}

// stripFansubBracket removes a leading "[Group]" fansub tag from raw and
// returns the remaining text along with the extracted group name.
func stripFansubBracket(raw string) (rest string, fansubGroup string, hasFansubBracket bool) {
	match := fansubBracketRE.FindStringSubmatch(raw)
	if len(match) != 2 {
		return raw, "", false
	}
	return strings.TrimSpace(raw[len(match[0]):]), strings.TrimSpace(match[1]), true
}

// extractGroup returns the scene/release group from decodedRaw's trailing
// "-GROUP" suffix, falling back to a fansub bracket group when present.
func extractGroup(decodedRaw, fansubGroup string) string {
	if match := groupRE.FindStringSubmatch(strings.TrimSpace(decodedRaw)); len(match) == 2 && !isMetadataToken(match[1]) {
		return match[1]
	}
	return fansubGroup
}

// extractSeasonEpisode reads a season/episode pair from any of the three
// season marker forms (S01E04, 1x04, "Season 1").
func extractSeasonEpisode(input string) (season, episode string) {
	if match := seasonRE.FindStringSubmatch(input); len(match) > 1 {
		return match[1], match[2]
	}
	if match := xEpisodeRE.FindStringSubmatch(input); len(match) == 3 {
		return match[1], match[2]
	}
	if match := seasonWordRE.FindStringSubmatch(input); len(match) == 2 {
		return match[1], ""
	}
	return "", ""
}

// applyWeakNumberMarkers fills Episode (if not already known)/Volume/Issue
// from bare "Episode N"/"Volume N"/"Issue N" markers. These are only
// trustworthy when the release carries no video-specific signal; otherwise
// they are very likely part of a movie's own title (e.g. "Star Wars
// Episode 4", "Kill Bill Volume 1") and must not change Type or truncate
// the title.
func applyWeakNumberMarkers(result *Result, input string, hasVideoSignal bool) {
	if hasVideoSignal {
		return
	}
	if match := podcastEpisodeRE.FindStringSubmatch(input); result.Episode == "" && len(match) == 2 {
		result.Episode = match[1]
	}
	if match := volumeRE.FindStringSubmatch(input); len(match) == 2 {
		result.Volume = match[1]
	}
	if match := issueRE.FindStringSubmatch(input); len(match) == 2 {
		result.Issue = match[1]
	}
}

// extractAnimeEpisode reports whether input looks like an anime release
// (fansub bracket or an anime marker word) and, if so and episode is not
// already known, fills it from the "- NN" suffix pattern common to fansub
// releases.
func extractAnimeEpisode(input string, hasFansubBracket bool, episode string) (isAnimeSignal bool, resolvedEpisode string) {
	isAnimeSignal = hasFansubBracket || animeMarkerRE.MatchString(input)
	if episode != "" || !isAnimeSignal {
		return isAnimeSignal, episode
	}
	if match := animeEpisodeRE.FindStringSubmatch(input); len(match) == 2 {
		return isAnimeSignal, match[1]
	}
	return isAnimeSignal, episode
}

// finalizeTitle extracts the release title and applies type-specific title
// overrides (an OS release uses its distro's display name; an anime
// release's title excludes the "- NN" episode suffix).
func finalizeTitle(result Result, input string, hasVideoSignal bool) string {
	title := titleBeforeMetadata(input, hasVideoSignal)
	if result.Type == ReleaseTypeOS {
		return displayDistro(result.Distro)
	}
	if result.Type == ReleaseTypeAnime {
		if loc := animeEpisodeRE.FindStringSubmatchIndex(title); loc != nil {
			return strings.TrimSpace(title[:loc[0]])
		}
	}
	return title
}

// computeConfidence scores how trustworthy the parse is: any single strong
// marker, or two weak markers together, means high confidence.
func computeConfidence(result Result) Confidence {
	strongCount := 0
	for _, value := range strongConfidenceFields(result) {
		if value != "" {
			strongCount++
		}
	}
	weakCount := 0
	for _, value := range weakConfidenceFields(result) {
		if value != "" {
			weakCount++
		}
	}
	switch {
	case strongCount >= 1 || weakCount >= 2:
		return ConfidenceHigh
	case weakCount >= 1 || len([]rune(result.Title)) >= 2:
		return ConfidenceMedium
	}
	return ConfidenceLow
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
	add("group", r.Group)
	return tags
}

// ignorableFileExtensions are torrent payload files that carry no format
// signal (subtitles, checksums, screenshots, release notes) and should not
// count toward the dominant-format vote in RefineWithFileExtensions.
var ignorableFileExtensions = map[string]bool{
	"nfo": true, "txt": true, "jpg": true, "jpeg": true, "png": true, "gif": true,
	"sfv": true, "md5": true, "url": true, "srt": true, "sub": true, "idx": true, "ass": true,
}

// RefineWithFileExtensions upgrades a low-signal parse using the file
// extensions found inside a multi-file torrent, for cases where the release
// name itself carries no format hint (e.g. a generically named batch of
// ebooks or comics). It is a no-op when the name already yielded a format.
func (r Result) RefineWithFileExtensions(extensions []string) Result {
	if r.Format != "" || len(extensions) == 0 {
		return r
	}

	counts := make(map[string]int, len(extensions))
	for _, ext := range extensions {
		ext = strings.ToLower(strings.TrimPrefix(ext, "."))
		if ext == "" || ignorableFileExtensions[ext] {
			continue
		}
		counts[ext]++
	}

	dominant, dominantCount := "", 0
	for ext, count := range counts {
		if count > dominantCount || (count == dominantCount && ext < dominant) {
			dominant, dominantCount = ext, count
		}
	}
	if dominant == "" || !formatRE.MatchString(dominant) {
		return r
	}

	r.Format = dominant
	// Re-detect from the full normalized raw name, not just Title: a marker
	// word like "Audiobook" is a title-cut point (see titleCutRegexes) and
	// so is already gone from Title by this point, but detectType still
	// needs it to keep classifying the release as an audiobook/comic/etc.
	// rather than falling back to whatever the new format alone implies.
	r.Type = detectType(r, normalize(html.UnescapeString(r.Raw)), r.Type == ReleaseTypeAnime)
	r = withVersionCleared(r)
	r.Confidence = ConfidenceHigh
	return r
}

// withVersionCleared drops a detected version number for release types where
// a bare number is more likely a volume/edition artifact than a real
// software version (only OS/Game/Software releases keep it).
func withVersionCleared(r Result) Result {
	if r.Type != ReleaseTypeOS && r.Type != ReleaseTypeGame && r.Type != ReleaseTypeSoftware {
		r.Version = ""
	}
	return r
}

// isMetadataToken reports whether value is itself a recognized metadata
// keyword (resolution, codec, source, ...) rather than a plausible release
// group name. It guards groupRE against trailing tokens like "1080p" or
// "REMUX" being mistaken for a scene group.
func isMetadataToken(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return false
	}
	fullMatch := func(re *regexp.Regexp) bool {
		loc := re.FindStringIndex(trimmed)
		return loc != nil && loc[0] == 0 && loc[1] == len(trimmed)
	}
	return fullMatch(resolutionRE) || fullMatch(sourceRE) || fullMatch(codecRE) ||
		fullMatch(audioRE) || fullMatch(languageRE) || fullMatch(editionRE) ||
		fullMatch(hdrRE) || fullMatch(formatRE) || fullMatch(architectureRE) ||
		fullMatch(regionRE) || fullMatch(packageRE) || fullMatch(yearRE)
}

func normalize(raw string) string {
	value := separatorRE.ReplaceAllString(strings.TrimSpace(raw), " ")
	value = strings.ReplaceAll(value, "_", " ")
	return spaceRE.ReplaceAllString(value, " ")
}

// titleCutRegexes are always-reliable metadata markers: wherever the
// earliest one starts, the release title ends.
var titleCutRegexes = []*regexp.Regexp{yearRE, seasonRE, xEpisodeRE, seasonWordRE, resolutionRE, sourceRE, codecRE, audioRE, languageRE, editionRE, hdrRE, formatRE, versionMarkerRE, gameMarkerRE, audiobookMarkerRE, comicMarkerRE, courseMarkerRE, datasetMarkerRE, romMarkerRE, romPlatformRE, podcastMarkerRE, animeMarkerRE, regionRE, providerRE, packageRE}

// titleCutRegexesWeak (bare "Episode/Volume/Issue N") only count as a title
// boundary when the release has no video signal — see hasVideoSignal in
// Parse for why they are ambiguous otherwise.
var titleCutRegexesWeak = []*regexp.Regexp{podcastEpisodeRE, volumeRE, issueRE}

func titleBeforeMetadata(input string, hasVideoSignal bool) string {
	positions := make([]int, 0, len(titleCutRegexes)+len(titleCutRegexesWeak))
	for _, re := range titleCutRegexes {
		if index := re.FindStringIndex(input); index != nil {
			positions = append(positions, index[0])
		}
	}
	if !hasVideoSignal {
		for _, re := range titleCutRegexesWeak {
			if index := re.FindStringIndex(input); index != nil {
				positions = append(positions, index[0])
			}
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
func canonicalLanguage(value string) string {
	value = canonical(value)
	value = strings.ReplaceAll(value, " ", "-")
	if value == "ptbr" || value == "pt-br" {
		return "pt-br"
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

// typeRules is an explicit priority table: the first matching rule wins.
// Order is significant (e.g. a "kaggle tutorial" matches both Dataset and
// Course) and is spelled out here as data instead of buried in control flow,
// so priority is visible and easy to adjust when a new type is added.
var typeRules = []struct {
	match func(r Result, input string, isAnimeSignal bool) bool
	typ   ReleaseType
}{
	{func(r Result, input string, _ bool) bool {
		return isDataset(r.Format) || datasetMarkerRE.MatchString(input)
	}, ReleaseTypeDataset},
	{func(_ Result, input string, _ bool) bool { return courseMarkerRE.MatchString(input) }, ReleaseTypeCourse},
	{func(r Result, input string, _ bool) bool {
		return r.Format == "m4b" || r.Format == "aax" || r.Format == "aaxc" || audiobookMarkerRE.MatchString(input)
	}, ReleaseTypeAudiobook},
	{func(r Result, input string, _ bool) bool {
		return r.Format == "cbz" || r.Format == "cbr" || comicMarkerRE.MatchString(input)
	}, ReleaseTypeComic},
	{func(_ Result, input string, _ bool) bool {
		return romMarkerRE.MatchString(input) || romPlatformRE.MatchString(input)
	}, ReleaseTypeROM},
	{func(r Result, input string, _ bool) bool {
		return isSoftwarePackage(r.Format) || softwareMarkerRE.MatchString(input)
	}, ReleaseTypeSoftware},
	{func(r Result, _ string, _ bool) bool { return r.Distro != "" }, ReleaseTypeOS},
	{func(r Result, input string, _ bool) bool {
		return podcastMarkerRE.MatchString(input) || (r.Episode != "" && isAudioFormat(r.Format))
	}, ReleaseTypePodcast},
	{func(_ Result, _ string, isAnimeSignal bool) bool { return isAnimeSignal }, ReleaseTypeAnime},
	{func(r Result, _ string, _ bool) bool {
		return r.Format == "epub" || r.Format == "mobi" || r.Format == "azw3" || r.Format == "pdf" || r.Format == "cbz" || r.Format == "cbr" || r.Volume != ""
	}, ReleaseTypeBook},
	{func(r Result, _ string, _ bool) bool { return isAudioFormat(r.Format) }, ReleaseTypeMusic},
	{func(r Result, input string, _ bool) bool { return r.Platform != "" || gameMarkerRE.MatchString(input) }, ReleaseTypeGame},
	{func(r Result, _ string, _ bool) bool { return r.Season != "" || r.Episode != "" }, ReleaseTypeSeries},
}

func detectType(result Result, input string, isAnimeSignal bool) ReleaseType {
	for _, rule := range typeRules {
		if rule.match(result, input, isAnimeSignal) {
			return rule.typ
		}
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
