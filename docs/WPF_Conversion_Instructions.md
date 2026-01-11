# WPF Conversion Instructions: View 4 Chat Interface

## Overview

This document provides complete instructions for converting the View 4 Chat Interface from the Adelphos AI website (HTML/CSS/JavaScript) to a WPF (Windows Presentation Foundation) desktop application.

The interface is an AI-powered MEP (Mechanical, Electrical, Plumbing) design assistant with:
- Conversation-based chat with multiple MEP system contexts
- Animated "thinking" containers showing AI processing steps
- Neural node with pulsing animation
- Sidebar with conversation history and file tree
- Dropdown menus for agent mode and model selection
- Video playback area showing design output

---

## Architecture Recommendation

Use the **MVVM (Model-View-ViewModel)** pattern:

```
├── Models/
│   ├── Message.cs
│   ├── ThinkingStep.cs
│   ├── Conversation.cs
│   ├── HistoryItem.cs
│   └── FileTreeItem.cs
├── ViewModels/
│   ├── MainViewModel.cs
│   ├── ChatViewModel.cs
│   ├── ConversationViewModel.cs
│   └── ThinkingContainerViewModel.cs
├── Views/
│   ├── MainWindow.xaml
│   ├── ChatView.xaml
│   └── ThinkingContainerView.xaml
├── Controls/
│   ├── NeuralNode.xaml
│   └── ThinkingContainer.xaml
├── Resources/
│   ├── Colors.xaml
│   ├── Styles.xaml
│   └── Animations.xaml
└── Converters/
    └── BoolToVisibilityConverter.cs
```

---

## Color Palette

### Light Mode
```xaml
<!-- Primary brand colors -->
<Color x:Key="PrimaryColor">#156082</Color>
<Color x:Key="PrimaryHover">#1a7299</Color>
<Color x:Key="AccentTeal">#4a9bb8</Color>

<!-- Backgrounds -->
<Color x:Key="BgPrimary">#FFFFFF</Color>
<Color x:Key="BgSecondary">#F5F5F5</Color>
<Color x:Key="BgTertiary">#FAFAFA</Color>
<Color x:Key="SidebarBg">#ECECEC</Color>

<!-- Borders -->
<Color x:Key="BorderLight">#E0E0E0</Color>
<Color x:Key="BorderSubtle">#E8E8E8</Color>

<!-- Text -->
<Color x:Key="TextPrimary">#333333</Color>
<Color x:Key="TextSecondary">#666666</Color>
<Color x:Key="TextMuted">#888888</Color>
<Color x:Key="TextPlaceholder">#999999</Color>

<!-- Status colors -->
<Color x:Key="SuccessGreen">#22863A</Color>
<Color x:Key="ErrorRed">#D73A49</Color>
<Color x:Key="WarningOrange">#E67E22</Color>
```

### Dark Mode
```xaml
<!-- Backgrounds -->
<Color x:Key="BgPrimaryDark">#1A1A1A</Color>
<Color x:Key="BgSecondaryDark">#252525</Color>
<Color x:Key="BgTertiaryDark">#2A2A2A</Color>
<Color x:Key="SidebarBgDark">#1E1E1E</Color>
<Color x:Key="TitlebarBgDark">#2D2D2D</Color>

<!-- Borders -->
<Color x:Key="BorderDark">#3A3A3A</Color>

<!-- Text -->
<Color x:Key="TextPrimaryDark">#CCCCCC</Color>
<Color x:Key="TextSecondaryDark">#999999</Color>
<Color x:Key="TextMutedDark">#777777</Color>
<Color x:Key="TextPlaceholderDark">#666666</Color>

<!-- Status colors (brighter for dark mode) -->
<Color x:Key="SuccessGreenDark">#4CD964</Color>
<Color x:Key="ErrorRedDark">#F85149</Color>
<Color x:Key="AccentTealDark">#4A9BB8</Color>
```

### File Type Icon Colors
```xaml
<Color x:Key="FileRvt">#3498DB</Color>   <!-- Revit - Blue -->
<Color x:Key="FileDwg">#E67E22</Color>   <!-- AutoCAD - Orange -->
<Color x:Key="FilePdf">#E74C3C</Color>   <!-- PDF - Red -->
<Color x:Key="FileXlsx">#27AE60</Color>  <!-- Excel - Green -->
<Color x:Key="FileDocx">#2980B9</Color>  <!-- Word - Blue -->
```

---

## Data Models

### Message.cs
```csharp
public enum MessageType
{
    User,
    Bot,
    Thinking
}

public class Message : INotifyPropertyChanged
{
    public MessageType Type { get; set; }
    public string Text { get; set; }
    public ObservableCollection<ThinkingStep> Steps { get; set; } // For Thinking type
    public bool IsCompleted { get; set; }
    public TimeSpan ThinkingDuration { get; set; }
}
```

### ThinkingStep.cs
```csharp
public enum StepType
{
    Think,    // Grey dot icon
    Action,   // Pencil icon with file changes
    Done,     // Green checkmark
    Error     // Red X icon
}

public class ThinkingStep : INotifyPropertyChanged
{
    public string Text { get; set; }
    public StepType Type { get; set; }
    public string Changes { get; set; }      // e.g., "+366" or "-24"
    public string Filename { get; set; }     // e.g., "drainage-layout.rvt"
    public bool IsVisible { get; set; }
    public bool IsPreviewHidden { get; set; } // Hidden during animation collapse
}
```

### Conversation.cs
```csharp
public class Conversation
{
    public string Key { get; set; }           // e.g., "drainage", "water"
    public string Title { get; set; }         // e.g., "Drainage"
    public string Preview { get; set; }       // e.g., "SVP positions determined"
    public string SystemType { get; set; }    // MEP system identifier
    public ObservableCollection<Message> Messages { get; set; }
    public List<ThinkingStep> ThinkingSequence { get; set; } // Animation steps
    public string FinalMessage { get; set; }
    public string ReadyPrompt { get; set; }
    public bool IsCompleted { get; set; }
    public bool IsActive { get; set; }
}
```

### FileTreeItem.cs
```csharp
public class FileTreeItem : INotifyPropertyChanged
{
    public string Name { get; set; }
    public string FileType { get; set; }      // "rvt", "dwg", "pdf", "xlsx", "folder"
    public bool IsFolder { get; set; }
    public bool IsExpanded { get; set; }
    public ObservableCollection<FileTreeItem> Children { get; set; }
}
```

---

## Complete Conversation Data

Include all 10 MEP system conversations. Here is the full data structure:

```csharp
public static class ConversationData
{
    public static Dictionary<string, Conversation> Conversations = new()
    {
        ["drainage"] = new Conversation
        {
            Key = "drainage",
            Title = "Drainage",
            Preview = "SVP positions determined",
            Messages = new ObservableCollection<Message>
            {
                new Message { Type = MessageType.User, Text = "Can you design the drainage system?" },
                new Message { Type = MessageType.Bot, Text = "Of course, let me check the rooms." },
                new Message
                {
                    Type = MessageType.Thinking,
                    Steps = new ObservableCollection<ThinkingStep>
                    {
                        new ThinkingStep { Text = "Finding rooms...", Type = StepType.Think },
                        new ThinkingStep { Text = "24 rooms found.", Type = StepType.Think },
                        new ThinkingStep { Text = "Checking number of outlets.", Type = StepType.Think },
                        new ThinkingStep { Text = "Checking for further drainage requirements.", Type = StepType.Think },
                        new ThinkingStep { Text = "Reading specification.", Type = StepType.Think },
                        new ThinkingStep { Text = "Calculating condensate connection requirements.", Type = StepType.Think },
                        new ThinkingStep { Text = "Looking for civil pop up information...", Type = StepType.Think },
                        new ThinkingStep { Text = "Stopped — awaiting civil data.", Type = StepType.Done }
                    }
                },
                new Message { Type = MessageType.Bot, Text = "Do you have civil engineering information?" },
                new Message { Type = MessageType.User, Text = "Yes, sorry just added to the folder now." },
                new Message
                {
                    Type = MessageType.Thinking,
                    Steps = new ObservableCollection<ThinkingStep>
                    {
                        new ThinkingStep { Text = "Continuing.", Type = StepType.Think },
                        new ThinkingStep { Text = "Reading civil drawings.", Type = StepType.Think },
                        new ThinkingStep { Text = "Pop up locations found — different to requirements.", Type = StepType.Think },
                        new ThinkingStep { Text = "Placing pop ups on drawing.", Type = StepType.Action, Changes = "+366", Filename = "drainage-layout.rvt" },
                        new ThinkingStep { Text = "Done.", Type = StepType.Done }
                    }
                },
                new Message { Type = MessageType.Bot, Text = "Can you check to see if you are happy? If happy, type yes or proceed to continue." }
            },
            ThinkingSequence = new List<ThinkingStep>
            {
                new ThinkingStep { Text = "Thinking...", Type = StepType.Think },
                new ThinkingStep { Text = "Placing branch pipes and outlet positions.", Type = StepType.Action, Changes = "+48", Filename = "drainage-layout.rvt" },
                new ThinkingStep { Text = "Designing in 3D.", Type = StepType.Action, Changes = "+156", Filename = "drainage-layout.rvt" },
                new ThinkingStep { Text = "Forecasting clashes.", Type = StepType.Think },
                new ThinkingStep { Text = "Rerouting pipes to avoid clashes.", Type = StepType.Action, Changes = "+24", Filename = "drainage-layout.rvt" },
                new ThinkingStep { Text = "Done.", Type = StepType.Done }
            },
            FinalMessage = "Designed and added note on primary ventilation in compliance with BS EN 12056 & Approved Document H. Note: I have marked the SVPs that weren't on the civil engineering information with a hazard symbol — please send this drawing to the civil engineer for confirmation.",
            ReadyPrompt = "Type \"yes\" or \"proceed\" to generate drainage layout"
        },
        
        ["water"] = new Conversation
        {
            Key = "water",
            Title = "Water Services",
            Preview = "Outlets positioned",
            Messages = new ObservableCollection<Message>
            {
                new Message { Type = MessageType.User, Text = "Can you design the cold and hot water system?" },
                new Message { Type = MessageType.Bot, Text = "Of course, let me check the requirements and site constraints." },
                new Message
                {
                    Type = MessageType.Thinking,
                    Steps = new ObservableCollection<ThinkingStep>
                    {
                        new ThinkingStep { Text = "Reading specification...", Type = StepType.Think },
                        new ThinkingStep { Text = "Checking building location.", Type = StepType.Think },
                        new ThinkingStep { Text = "Analysing local utility provider constraints.", Type = StepType.Think },
                        new ThinkingStep { Text = "Understanding incoming water pressure — 2.1 bar static.", Type = StepType.Think },
                        new ThinkingStep { Text = "Calculating pressure requirements for upper floors.", Type = StepType.Think },
                        new ThinkingStep { Text = "Booster set required — pressure insufficient above Level 3.", Type = StepType.Think },
                        new ThinkingStep { Text = "Checking water hardness data — 285 ppm (hard water zone).", Type = StepType.Think },
                        new ThinkingStep { Text = "Water softener required as per specification.", Type = StepType.Think },
                        new ThinkingStep { Text = "Reading BS EN 806 requirements.", Type = StepType.Think },
                        new ThinkingStep { Text = "Analysis complete — awaiting confirmation.", Type = StepType.Done }
                    }
                },
                new Message { Type = MessageType.Bot, Text = "Based on my analysis:\n• Incoming pressure: 2.1 bar static (insufficient for upper floors)\n• Booster set: Required for Levels 3+\n• Water hardness: 285 ppm — softener required per spec\n• Standard: BS EN 806 compliance\n\nShall I proceed with the design?" },
                new Message { Type = MessageType.User, Text = "Yes, proceed." },
                new Message
                {
                    Type = MessageType.Thinking,
                    Steps = new ObservableCollection<ThinkingStep>
                    {
                        new ThinkingStep { Text = "Continuing.", Type = StepType.Think },
                        new ThinkingStep { Text = "Reading room schedule for outlet requirements.", Type = StepType.Think },
                        new ThinkingStep { Text = "Identifying point-of-use water heater locations.", Type = StepType.Think },
                        new ThinkingStep { Text = "Placing cold water outlets.", Type = StepType.Action, Changes = "+186", Filename = "water-services.rvt" },
                        new ThinkingStep { Text = "Placing hot water outlets.", Type = StepType.Action, Changes = "+142", Filename = "water-services.rvt" },
                        new ThinkingStep { Text = "Adding point-of-use water heaters (as spec).", Type = StepType.Action, Changes = "+24", Filename = "water-services.rvt" },
                        new ThinkingStep { Text = "Placing booster set in plantroom.", Type = StepType.Action, Changes = "+8", Filename = "water-services.rvt" },
                        new ThinkingStep { Text = "Placing water softener in plantroom.", Type = StepType.Action, Changes = "+4", Filename = "water-services.rvt" },
                        new ThinkingStep { Text = "Done.", Type = StepType.Done }
                    }
                },
                new Message { Type = MessageType.Bot, Text = "Water outlets placed. Ready to route pipework and generate calculations?" }
            },
            ThinkingSequence = new List<ThinkingStep>
            {
                new ThinkingStep { Text = "Thinking...", Type = StepType.Think },
                new ThinkingStep { Text = "Calculating pipe sizes based on loading units.", Type = StepType.Think },
                new ThinkingStep { Text = "Routing cold water mains from intake.", Type = StepType.Action, Changes = "+486", Filename = "water-services.rvt" },
                new ThinkingStep { Text = "Routing hot water distribution pipework.", Type = StepType.Action, Changes = "+324", Filename = "water-services.rvt" },
                new ThinkingStep { Text = "Checking dead legs compliance.", Type = StepType.Think },
                new ThinkingStep { Text = "Generating calculation report.", Type = StepType.Think },
                new ThinkingStep { Text = "Saving calculations to folder.", Type = StepType.Action, Changes = "+1", Filename = "Water_Calcs_BS-EN-806.pdf" },
                new ThinkingStep { Text = "Done.", Type = StepType.Done }
            },
            FinalMessage = "Water services design complete:\n• 186 cold water outlets placed\n• 142 hot water outlets placed\n• 24 point-of-use water heaters (per specification)\n• Booster set and softener positioned in plantroom\n• Pipework routed in 3D with clash avoidance\n• Calculations saved: Water_Calcs_BS-EN-806.pdf\n\nDesign complies with BS EN 806. Ready for review.",
            ReadyPrompt = "Type \"yes\" or \"proceed\" to route pipework"
        },
        
        ["heating"] = new Conversation
        {
            Key = "heating",
            Title = "Heating & Cooling",
            Preview = "FCUs & VRF designed",
            // ... (see full JavaScript data in view4-chat.js)
        },
        
        ["ventilation"] = new Conversation
        {
            Key = "ventilation",
            Title = "Ventilation",
            Preview = "Grilles positioned",
            // ... (see full JavaScript data)
        },
        
        ["controls"] = new Conversation
        {
            Key = "controls",
            Title = "Controls & Plant",
            Preview = "BMS points listed",
            // ...
        },
        
        ["containment"] = new Conversation
        {
            Key = "containment",
            Title = "Containment",
            Preview = "Tray routes designed",
            // ...
        },
        
        ["power"] = new Conversation
        {
            Key = "power",
            Title = "Power",
            Preview = "Distribution designed",
            // ...
        },
        
        ["lighting"] = new Conversation
        {
            Key = "lighting",
            Title = "Lighting",
            Preview = "Luminaires placed",
            // ...
        },
        
        ["firealarms"] = new Conversation
        {
            Key = "firealarms",
            Title = "Fire Alarms",
            Preview = "Devices positioned",
            // ...
        },
        
        ["security"] = new Conversation
        {
            Key = "security",
            Title = "Security & Access Control",
            Preview = "Readers positioned",
            // ...
        }
    };
}
```

---

## Main Window Layout (XAML Structure)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MAIN WINDOW                                  │
├────────────────────────────┬────────────────────────────────────────┤
│     TEXT PANEL (40%)       │       CONTAINERS PANEL (60%)           │
│                            │  ┌─────────────────────────────────┐   │
│  ┌──────────────────────┐  │  │         CHAT BOX (50%)          │   │
│  │                      │  │  │  ┌───────────────────────────┐  │   │
│  │   Demo Heading       │  │  │  │       TITLEBAR            │  │   │
│  │                      │  │  │  ├───────────┬───────────────┤  │   │
│  │   Description text   │  │  │  │  SIDEBAR  │   MAIN CHAT   │  │   │
│  │   with paragraphs    │  │  │  │           │               │  │   │
│  │                      │  │  │  │  Tabs     │  Design Tabs  │  │   │
│  │   [Example Output]   │  │  │  │  Search   │  Messages     │  │   │
│  │                      │  │  │  │  History  │  Thinking     │  │   │
│  │                      │  │  │  │  Files    │  Neural Node  │  │   │
│  └──────────────────────┘  │  │  │           │  Input Row    │  │   │
│                            │  │  └───────────┴───────────────┘  │   │
│                            │  └─────────────────────────────────┘   │
│                            │  ┌─────────────────────────────────┐   │
│                            │  │        REVIT BOX (50%)          │   │
│                            │  │  ┌───────────────────────────┐  │   │
│                            │  │  │       TITLEBAR            │  │   │
│                            │  │  ├───────────────────────────┤  │   │
│                            │  │  │                           │  │   │
│                            │  │  │   VIDEO / PREVIEW AREA    │  │   │
│                            │  │  │                           │  │   │
│                            │  │  └───────────────────────────┘  │   │
│                            │  └─────────────────────────────────┘   │
└────────────────────────────┴────────────────────────────────────────┘
```

### XAML Skeleton

```xml
<Window x:Class="AdelphosChat.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="JASON — Chat"
        Width="1400" Height="900"
        Background="{DynamicResource BgPrimary}">
    
    <Window.Resources>
        <ResourceDictionary>
            <ResourceDictionary.MergedDictionaries>
                <ResourceDictionary Source="Resources/Colors.xaml"/>
                <ResourceDictionary Source="Resources/Styles.xaml"/>
                <ResourceDictionary Source="Resources/Animations.xaml"/>
            </ResourceDictionary.MergedDictionaries>
        </ResourceDictionary>
    </Window.Resources>
    
    <Grid>
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="40*"/>  <!-- Text Panel -->
            <ColumnDefinition Width="60*"/>  <!-- Containers Panel -->
        </Grid.ColumnDefinitions>
        
        <!-- TEXT PANEL -->
        <Border Grid.Column="0" Padding="40">
            <StackPanel VerticalAlignment="Center">
                <TextBlock Text="Automated MEP Floorplan Generation."
                           Style="{StaticResource HeadingStyle}"/>
                <TextBlock Style="{StaticResource BodyStyle}">
                    Upload your architectural floorplan and receive complete 
                    MEP service layouts in minutes, not weeks.
                </TextBlock>
                <Button Content="See example output" 
                        Style="{StaticResource ExampleButtonStyle}"/>
            </StackPanel>
        </Border>
        
        <!-- CONTAINERS PANEL -->
        <Grid Grid.Column="1" Margin="20">
            <Grid.RowDefinitions>
                <RowDefinition Height="*"/>   <!-- Chat Box -->
                <RowDefinition Height="*"/>   <!-- Revit Box -->
            </Grid.RowDefinitions>
            
            <!-- CHAT BOX -->
            <Border Grid.Row="0" Style="{StaticResource WindowBoxStyle}">
                <Grid>
                    <Grid.RowDefinitions>
                        <RowDefinition Height="30"/>  <!-- Titlebar -->
                        <RowDefinition Height="*"/>   <!-- Body -->
                    </Grid.RowDefinitions>
                    
                    <!-- Titlebar -->
                    <Border Grid.Row="0" Style="{StaticResource TitlebarStyle}">
                        <Grid>
                            <TextBlock Text="JASON — Chat" 
                                       Style="{StaticResource TitlebarTextStyle}"/>
                            <StackPanel Orientation="Horizontal" 
                                        HorizontalAlignment="Right">
                                <Button Style="{StaticResource MinButtonStyle}"/>
                                <Button Style="{StaticResource MaxButtonStyle}"/>
                                <Button Style="{StaticResource CloseButtonStyle}"/>
                            </StackPanel>
                        </Grid>
                    </Border>
                    
                    <!-- Body - Sidebar + Main -->
                    <Grid Grid.Row="1">
                        <Grid.ColumnDefinitions>
                            <ColumnDefinition Width="30*" MinWidth="120" MaxWidth="400"/>
                            <ColumnDefinition Width="Auto"/>  <!-- Resize Grip -->
                            <ColumnDefinition Width="70*"/>
                        </Grid.ColumnDefinitions>
                        
                        <!-- SIDEBAR -->
                        <Border Grid.Column="0" 
                                Background="{DynamicResource SidebarBg}">
                            <local:ChatSidebar DataContext="{Binding}"/>
                        </Border>
                        
                        <!-- Resize Grip -->
                        <GridSplitter Grid.Column="1" Width="4" 
                                      Background="Transparent"
                                      HorizontalAlignment="Center"/>
                        
                        <!-- MAIN CHAT AREA -->
                        <Grid Grid.Column="2">
                            <Grid.RowDefinitions>
                                <RowDefinition Height="Auto"/>  <!-- Design Tabs -->
                                <RowDefinition Height="*"/>     <!-- Messages -->
                                <RowDefinition Height="Auto"/>  <!-- Neural Node -->
                                <RowDefinition Height="Auto"/>  <!-- Input Row -->
                            </Grid.RowDefinitions>
                            
                            <!-- Design Options Tabs -->
                            <local:DesignOptionsTabs Grid.Row="0"/>
                            
                            <!-- Messages Area -->
                            <ScrollViewer Grid.Row="1" 
                                          VerticalScrollBarVisibility="Auto">
                                <ItemsControl ItemsSource="{Binding Messages}"
                                              ItemTemplate="{StaticResource MessageTemplate}"/>
                            </ScrollViewer>
                            
                            <!-- Neural Node -->
                            <local:NeuralNode Grid.Row="2" 
                                              DataContext="{Binding NeuralNodeVM}"/>
                            
                            <!-- Input Row -->
                            <local:ChatInputRow Grid.Row="3"/>
                        </Grid>
                    </Grid>
                </Grid>
            </Border>
            
            <!-- REVIT BOX -->
            <Border Grid.Row="1" Style="{StaticResource WindowBoxStyle}" 
                    Margin="0,10,0,0">
                <Grid>
                    <Grid.RowDefinitions>
                        <RowDefinition Height="30"/>
                        <RowDefinition Height="*"/>
                    </Grid.RowDefinitions>
                    
                    <Border Grid.Row="0" Style="{StaticResource TitlebarStyle}">
                        <TextBlock Text="Revit MEP — Floorplan Design"/>
                    </Border>
                    
                    <MediaElement Grid.Row="1" 
                                  Source="{Binding VideoSource}"
                                  LoadedBehavior="Manual"/>
                </Grid>
            </Border>
        </Grid>
    </Grid>
</Window>
```

---

## Custom Controls

### 1. ThinkingContainer Control

The thinking container shows AI processing steps with expand/collapse functionality.

**Visual Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ [●] 8 steps                                           [⌃]  │  ← Header (clickable)
├─────────────────────────────────────────────────────────────┤
│ │ ● Finding rooms...                                        │  ← Step with dot
│ │ ● 24 rooms found.                                         │
│ │ ● Checking number of outlets.                             │
│ │ ✎ Placing pop ups on drawing.    [+366] drainage.rvt     │  ← Action step
│ │ ✓ Done.                                                   │  ← Done step (green)
├─────────────────────────────────────────────────────────────┤
│ Thinking...                                    (shimmer)    │  ← Status (during)
├─────────────────────────────────────────────────────────────┤
│ Thought for 2m 34s                                    [▼]   │  ← Trail (after)
└─────────────────────────────────────────────────────────────┘
```

**XAML Template:**
```xml
<UserControl x:Class="AdelphosChat.Controls.ThinkingContainer">
    <Border Background="{DynamicResource BgTertiary}"
            BorderBrush="{DynamicResource BorderSubtle}"
            BorderThickness="1"
            CornerRadius="12"
            Padding="6,10">
        <StackPanel>
            <!-- Header -->
            <Grid Cursor="Hand" MouseLeftButtonUp="Header_Click">
                <StackPanel Orientation="Horizontal">
                    <Ellipse Width="8" Height="8" 
                             Fill="{DynamicResource PrimaryColor}"/>
                    <TextBlock Text="{Binding StepsCount, StringFormat='{}{0} steps'}"
                               FontSize="10" Foreground="{DynamicResource TextMuted}"
                               Margin="8,0,0,0"/>
                </StackPanel>
                <TextBlock Text="⌃" HorizontalAlignment="Right"
                           Style="{StaticResource ChevronStyle}"/>
            </Grid>
            
            <!-- Steps List (collapsible) -->
            <ItemsControl ItemsSource="{Binding Steps}"
                          Visibility="{Binding IsExpanded, Converter={StaticResource BoolToVis}}"
                          Margin="7,8,0,0">
                <ItemsControl.ItemTemplate>
                    <DataTemplate>
                        <Grid Margin="0,6">
                            <!-- Vertical Line -->
                            <Border Width="1" Background="{DynamicResource BorderLight}"
                                    HorizontalAlignment="Left" Margin="3,0,0,0"/>
                            
                            <!-- Step Icon -->
                            <ContentControl Content="{Binding}" 
                                            ContentTemplate="{StaticResource StepIconTemplate}"
                                            HorizontalAlignment="Left"/>
                            
                            <!-- Step Content -->
                            <StackPanel Orientation="Horizontal" Margin="18,0,0,0">
                                <TextBlock Text="{Binding Text}" 
                                           FontSize="11"
                                           Foreground="{DynamicResource TextSecondary}"/>
                                
                                <!-- File Changes (for Action steps) -->
                                <Border Visibility="{Binding HasChanges, Converter={StaticResource BoolToVis}}"
                                        Background="{DynamicResource BgSecondary}"
                                        CornerRadius="4" Padding="8,2" Margin="12,0,0,0">
                                    <StackPanel Orientation="Horizontal">
                                        <TextBlock Text="{Binding Changes}"
                                                   Foreground="{DynamicResource SuccessGreen}"
                                                   FontFamily="Consolas" FontSize="10"/>
                                    </StackPanel>
                                </Border>
                                <TextBlock Text="{Binding Filename}"
                                           Foreground="{DynamicResource TextMuted}"
                                           FontSize="9" Margin="8,0,0,0"/>
                            </StackPanel>
                        </Grid>
                    </DataTemplate>
                </ItemsControl.ItemTemplate>
            </ItemsControl>
            
            <!-- Shiny Status (during thinking) -->
            <TextBlock x:Name="StatusText"
                       Visibility="{Binding IsThinking, Converter={StaticResource BoolToVis}}"
                       Style="{StaticResource ShimmerTextStyle}"/>
            
            <!-- Thought Trail (after completion) -->
            <StackPanel Visibility="{Binding IsCompleted, Converter={StaticResource BoolToVis}}"
                        Margin="0,8,0,0">
                <Border BorderBrush="{DynamicResource BorderSubtle}" 
                        BorderThickness="0,1,0,0" Padding="0,8,0,0">
                    <TextBlock>
                        <Run Text="Thought for " Foreground="{DynamicResource TextSecondary}"/>
                        <Run Text="{Binding Duration}" Foreground="{DynamicResource PrimaryColor}"/>
                    </TextBlock>
                </Border>
            </StackPanel>
        </StackPanel>
    </Border>
</UserControl>
```

### 2. Neural Node Control

Animated pulsing node that moves left/right during processing.

```xml
<UserControl x:Class="AdelphosChat.Controls.NeuralNode">
    <Canvas Width="200" Height="40">
        <!-- Glow Ring (animated) -->
        <Ellipse x:Name="GlowRing" 
                 Width="24" Height="24"
                 Canvas.Left="88" Canvas.Top="8"
                 Opacity="0">
            <Ellipse.Fill>
                <RadialGradientBrush>
                    <GradientStop Color="#156082" Offset="0"/>
                    <GradientStop Color="Transparent" Offset="1"/>
                </RadialGradientBrush>
            </Ellipse.Fill>
        </Ellipse>
        
        <!-- Core Node -->
        <Ellipse x:Name="CoreNode"
                 Width="12" Height="12"
                 Canvas.Left="94" Canvas.Top="14"
                 Fill="{DynamicResource PrimaryColor}">
            <Ellipse.Effect>
                <DropShadowEffect Color="#156082" BlurRadius="8" 
                                  ShadowDepth="0" Opacity="0.5"/>
            </Ellipse.Effect>
        </Ellipse>
        
        <!-- Status Text -->
        <TextBlock x:Name="StatusText"
                   Canvas.Left="120" Canvas.Top="12"
                   FontSize="10"
                   Foreground="{DynamicResource TextMuted}"
                   Text="{Binding StatusText}"/>
    </Canvas>
    
    <UserControl.Resources>
        <!-- Pulse Animation -->
        <Storyboard x:Key="PulseAnimation" RepeatBehavior="Forever">
            <DoubleAnimation Storyboard.TargetName="GlowRing"
                             Storyboard.TargetProperty="Opacity"
                             From="0.7" To="0" Duration="0:0:1"/>
            <DoubleAnimation Storyboard.TargetName="GlowRing"
                             Storyboard.TargetProperty="Width"
                             From="16" To="48" Duration="0:0:1"/>
            <DoubleAnimation Storyboard.TargetName="GlowRing"
                             Storyboard.TargetProperty="Height"
                             From="16" To="48" Duration="0:0:1"/>
        </Storyboard>
        
        <!-- Move Left Animation -->
        <Storyboard x:Key="MoveLeftAnimation">
            <DoubleAnimation Storyboard.TargetName="CoreNode"
                             Storyboard.TargetProperty="(Canvas.Left)"
                             To="20" Duration="0:0:0.4"
                             EasingFunction="{StaticResource EaseOut}"/>
        </Storyboard>
        
        <!-- Move Right Animation -->
        <Storyboard x:Key="MoveRightAnimation">
            <DoubleAnimation Storyboard.TargetName="CoreNode"
                             Storyboard.TargetProperty="(Canvas.Left)"
                             To="94" Duration="0:0:0.4"
                             EasingFunction="{StaticResource EaseOut}"/>
        </Storyboard>
    </UserControl.Resources>
</UserControl>
```

### 3. Chat Input Row

```xml
<UserControl x:Class="AdelphosChat.Controls.ChatInputRow">
    <Border Background="{DynamicResource BgSecondary}"
            BorderBrush="{DynamicResource BorderLight}"
            BorderThickness="1"
            CornerRadius="10"
            Padding="12,10">
        <StackPanel>
            <!-- Input Text -->
            <TextBox x:Name="InputTextBox"
                     Text="{Binding InputText, UpdateSourceTrigger=PropertyChanged}"
                     Style="{StaticResource ChatInputStyle}"
                     local:PlaceholderBehavior.Placeholder="Message..."/>
            
            <!-- Controls Row -->
            <Grid Margin="0,10,0,0">
                <StackPanel Orientation="Horizontal">
                    <!-- Agent Mode Dropdown -->
                    <local:DropdownButton Content="∞ Designer ▾"
                                          ItemsSource="{Binding AgentModes}"
                                          SelectedItem="{Binding SelectedAgentMode}"/>
                    
                    <!-- Model Dropdown -->
                    <local:DropdownButton Content="Build X 0.1 ▾"
                                          ItemsSource="{Binding Models}"
                                          SelectedItem="{Binding SelectedModel}"
                                          Margin="10,0,0,0"/>
                </StackPanel>
                
                <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
                    <!-- Share Button -->
                    <Button Content="⤴" Style="{StaticResource IconButtonStyle}"/>
                    
                    <!-- Meeting Mode Button -->
                    <Button Content="👥" Style="{StaticResource IconButtonStyle}"
                            Command="{Binding ToggleMeetingModeCommand}"/>
                    
                    <!-- Send Button -->
                    <Button Content="↑" Style="{StaticResource SendButtonStyle}"
                            Command="{Binding SendCommand}"/>
                </StackPanel>
            </Grid>
        </StackPanel>
    </Border>
</UserControl>
```

---

## Animation Specifications

### Timing Constants
```csharp
public static class AnimationTiming
{
    public static TimeSpan NodeMove = TimeSpan.FromMilliseconds(400);
    public static TimeSpan Pause = TimeSpan.FromMilliseconds(300);
    public static TimeSpan StepReveal = TimeSpan.FromMilliseconds(350);
    public static TimeSpan Collapse = TimeSpan.FromMilliseconds(400);
    public static TimeSpan MessageFadeIn = TimeSpan.FromMilliseconds(800);
}
```

### Neural Node Workflow Sequence

```csharp
public async Task RunNeuralNodeWorkflow()
{
    if (_isAnimating) return;
    _isAnimating = true;
    
    var startTime = DateTime.Now;
    
    // 1. Move node LEFT
    await MoveNodeLeft();
    await Task.Delay(AnimationTiming.NodeMove);
    
    // 2. PAUSE
    await Task.Delay(AnimationTiming.Pause);
    
    // 3. Start PULSING
    StartPulseAnimation();
    await Task.Delay(200);
    
    // 4. Create thinking container
    var thinkingContainer = CreateThinkingContainer(conversation.ThinkingSequence);
    Messages.Add(thinkingContainer);
    
    // 5. Reveal steps ONE BY ONE
    foreach (var step in conversation.ThinkingSequence)
    {
        step.IsVisible = true;
        UpdateStatusText(step);
        ScrollToBottom();
        await Task.Delay(AnimationTiming.StepReveal);
    }
    
    // 6. Mark complete
    var duration = DateTime.Now - startTime;
    thinkingContainer.IsCompleted = true;
    thinkingContainer.ThinkingDuration = duration;
    
    // 7. Collapse
    thinkingContainer.IsExpanded = false;
    await Task.Delay(AnimationTiming.Collapse);
    
    // 8. Add final message with fade-in
    AddMessageWithAnimation(conversation.FinalMessage);
    
    // 9. Move node RIGHT
    await MoveNodeRight();
    await Task.Delay(AnimationTiming.NodeMove);
    
    // 10. Stop pulsing
    StopPulseAnimation();
    
    _isAnimating = false;
}
```

### Shimmer Text Effect

For the "Thinking..." status text with shimmer animation:

```xml
<Style x:Key="ShimmerTextStyle" TargetType="TextBlock">
    <Setter Property="FontSize" Value="10"/>
    <Setter Property="FontWeight" Value="Normal"/>
    <Setter Property="Foreground">
        <Setter.Value>
            <LinearGradientBrush StartPoint="0,0" EndPoint="1,0">
                <LinearGradientBrush.Transform>
                    <TranslateTransform x:Name="ShimmerTransform"/>
                </LinearGradientBrush.Transform>
                <GradientStop Color="#888888" Offset="0"/>
                <GradientStop Color="#888888" Offset="0.4"/>
                <GradientStop Color="#FFFFFF" Offset="0.5"/>
                <GradientStop Color="#888888" Offset="0.6"/>
                <GradientStop Color="#888888" Offset="1"/>
            </LinearGradientBrush>
        </Setter.Value>
    </Setter>
    <Style.Triggers>
        <EventTrigger RoutedEvent="Loaded">
            <BeginStoryboard>
                <Storyboard RepeatBehavior="Forever">
                    <DoubleAnimation Storyboard.TargetProperty="Foreground.Transform.X"
                                     From="-200" To="200" 
                                     Duration="0:0:2"/>
                </Storyboard>
            </BeginStoryboard>
        </EventTrigger>
    </Style.Triggers>
</Style>
```

---

## Sidebar Structure

### Tabs: Designers / Files

```xml
<TabControl Style="{StaticResource SidebarTabStyle}">
    <!-- Designers Tab -->
    <TabItem Header="Designers">
        <StackPanel>
            <!-- Search -->
            <TextBox Style="{StaticResource SearchBoxStyle}"
                     Text="{Binding SearchText}"/>
            
            <!-- New Designer Button -->
            <Button Content="+ New Designer"
                    Style="{StaticResource NewDesignerButtonStyle}"/>
            
            <!-- History List -->
            <ListBox ItemsSource="{Binding Conversations}"
                     SelectedItem="{Binding ActiveConversation}"
                     ItemTemplate="{StaticResource ConversationItemTemplate}"/>
            
            <!-- Footer -->
            <TextBlock Text="{Binding ConversationCount, StringFormat='{}{0} designers'}"
                       Style="{StaticResource FooterTextStyle}"/>
        </StackPanel>
    </TabItem>
    
    <!-- Files Tab -->
    <TabItem Header="Files">
        <TreeView ItemsSource="{Binding FileTree}"
                  ItemTemplate="{StaticResource FileTreeTemplate}"/>
    </TabItem>
</TabControl>
```

### Conversation Item Template

```xml
<DataTemplate x:Key="ConversationItemTemplate">
    <Border Padding="10,8"
            Background="{Binding IsActive, Converter={StaticResource ActiveBgConverter}}"
            Cursor="Hand">
        <StackPanel>
            <TextBlock Text="{Binding Title}"
                       FontWeight="Medium" FontSize="11"
                       Foreground="{DynamicResource TextPrimary}"/>
            <TextBlock Text="{Binding Preview}"
                       FontSize="10"
                       Foreground="{DynamicResource TextMuted}"
                       TextTrimming="CharacterEllipsis"/>
        </StackPanel>
    </Border>
</DataTemplate>
```

---

## Message Templates

### User Message
```xml
<DataTemplate x:Key="UserMessageTemplate">
    <Border Background="{DynamicResource PrimaryColor}"
            CornerRadius="12,12,4,12"
            Padding="12,8"
            HorizontalAlignment="Right"
            MaxWidth="80%"
            Margin="0,4">
        <TextBlock Text="{Binding Text}"
                   Foreground="White"
                   TextWrapping="Wrap"
                   FontSize="12"/>
    </Border>
</DataTemplate>
```

### Bot Message
```xml
<DataTemplate x:Key="BotMessageTemplate">
    <Border Background="{DynamicResource BgSecondary}"
            CornerRadius="12,12,12,4"
            Padding="12,8"
            HorizontalAlignment="Left"
            MaxWidth="80%"
            Margin="0,4">
        <TextBlock Text="{Binding Text}"
                   Foreground="{DynamicResource TextPrimary}"
                   TextWrapping="Wrap"
                   FontSize="12"/>
    </Border>
</DataTemplate>
```

### Ready Prompt
```xml
<DataTemplate x:Key="ReadyPromptTemplate">
    <Border Background="{DynamicResource BgTertiary}"
            BorderBrush="{DynamicResource BorderSubtle}"
            BorderThickness="1"
            CornerRadius="8"
            Padding="16,12"
            HorizontalAlignment="Stretch"
            Margin="0,8">
        <TextBlock TextAlignment="Center" FontSize="11">
            <Run Text="Type " Foreground="{DynamicResource TextSecondary}"/>
            <Run Text="&quot;yes&quot;" FontWeight="Bold" Foreground="{DynamicResource TextPrimary}"/>
            <Run Text=" or " Foreground="{DynamicResource TextSecondary}"/>
            <Run Text="&quot;proceed&quot;" FontWeight="Bold" Foreground="{DynamicResource TextPrimary}"/>
            <Run Text=" to generate drainage layout" Foreground="{DynamicResource TextSecondary}"/>
        </TextBlock>
    </Border>
</DataTemplate>
```

---

## Files Changed Section

After completion, show affected files:

```xml
<Border Background="{DynamicResource BgTertiary}"
        BorderBrush="{DynamicResource BorderSubtle}"
        BorderThickness="1"
        CornerRadius="6"
        Margin="0,10">
    <StackPanel>
        <!-- Header -->
        <Grid Background="{DynamicResource BgSecondary}" Padding="10,6">
            <TextBlock Text="˅ 1 File" FontSize="10" FontWeight="Medium"/>
            <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
                <Button Content="Undo all" Style="{StaticResource LinkButtonStyle}"/>
                <Button Content="Keep All" Style="{StaticResource LinkButtonStyle}"/>
                <Button Content="Review" Style="{StaticResource PrimarySmallButtonStyle}"/>
            </StackPanel>
        </Grid>
        
        <!-- File List -->
        <ItemsControl ItemsSource="{Binding ChangedFiles}">
            <ItemsControl.ItemTemplate>
                <DataTemplate>
                    <Grid Padding="10,4">
                        <!-- File Icon -->
                        <Border Width="18" Height="18" CornerRadius="3"
                                Background="{Binding FileTypeColor}"
                                HorizontalAlignment="Left">
                            <TextBlock Text="{Binding FileTypeLabel}"
                                       FontSize="8" FontWeight="Bold"
                                       Foreground="White"
                                       HorizontalAlignment="Center"
                                       VerticalAlignment="Center"/>
                        </Border>
                        
                        <!-- Filename -->
                        <TextBlock Text="{Binding Filename}"
                                   Margin="26,0,0,0"
                                   FontSize="10"/>
                        
                        <!-- Changes -->
                        <TextBlock HorizontalAlignment="Right" FontSize="9">
                            <Run Text="{Binding Changes}" 
                                 Foreground="{DynamicResource SuccessGreen}"/>
                        </TextBlock>
                    </Grid>
                </DataTemplate>
            </ItemsControl.ItemTemplate>
        </ItemsControl>
    </StackPanel>
</Border>
```

---

## Key Implementation Notes

### 1. Dark Mode Toggle
Use a `DynamicResource` approach with merged dictionaries that swap between light/dark themes.

### 2. Scroll Behavior
- Auto-scroll to bottom when new messages arrive
- Prevent scroll propagation when inside chat area (trap wheel events)

### 3. Conversation State Persistence
- Save `chatHTML` equivalent (serialize messages) per conversation
- Mark conversations as `completed` to prevent re-running

### 4. Video Playback
- Use `MediaElement` with `LoadedBehavior="Manual"`
- Play video after thinking animation completes
- Support expand/maximize for Revit box

### 5. Fonts
- Primary: `Inter` (or `Segoe UI` as fallback)
- Monospace: `Consolas` or `SF Mono`
- Install Inter font or bundle with application

### 6. Dropdown Menus
- Use `Popup` control or `ComboBox` with custom template
- Show on hover with fade-in animation

---

## Summary Checklist

- [ ] Create solution with MVVM structure
- [ ] Implement color resources (light/dark)
- [ ] Create data models
- [ ] Build all conversation data
- [ ] Create ThinkingContainer control with expand/collapse
- [ ] Create NeuralNode control with pulse animation
- [ ] Create ChatInputRow with dropdowns
- [ ] Implement sidebar with tabs and file tree
- [ ] Create message templates (user, bot, thinking, prompt)
- [ ] Implement animation workflow
- [ ] Add shimmer text effect
- [ ] Create files changed section
- [ ] Implement dark mode toggle
- [ ] Add video/media playback

---

## Source Files Reference

The original implementation can be found in:
- `index.html` (lines 707-1022) - View 4 HTML structure
- `js/view4-chat.js` - Complete JavaScript logic and conversation data
- `css/thinking-animation.css` - Thinking container styles
- `css/index-styles.css` (lines 2622-4000) - Chat and demo styles

---

*Document created for WPF conversion by Claude. Last updated: January 2026*

