const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
require('dotenv').config();

// تحميل الإعدادات
let config;
try {
    config = require('./config.js');
} catch (error) {
    console.log('⚠️  لم يتم العثور على ملف config.js، استخدم config.example.js كمرجع');
    config = {
        DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
        CLIENT_ID: process.env.CLIENT_ID,
        GUILD_ID: process.env.GUILD_ID
    };
}

// إنشاء العميل
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// متغيرات البوت
const BOT_TOKEN = config.DISCORD_BOT_TOKEN;
const CLIENT_ID = config.CLIENT_ID;
const GUILD_ID = config.GUILD_ID;

// متغيرات الفعاليات النشطة
const activeActivities = new Map();

// متغير لتتبع المشاركين
const participants = new Map();

// متغير لتتبع العد التنازلي النشط
const activeCountdowns = new Map();

// أوامر البوت
const commands = [
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('إعداد البوت واختيار القناة للفعاليات'),
    new SlashCommandBuilder()
        .setName('countdown')
        .setDescription('بدء عد تنازلي مع خيارات الوقت')
        .addIntegerOption(option =>
            option.setName('الوقت')
                .setDescription('مدة العد التنازلي')
                .setMinValue(1)
                .setMaxValue(999)
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('النوع')
                .setDescription('نوع الوقت')
                .setRequired(true)
                .addChoices(
                    { name: 'دقائق', value: 'minutes' },
                    { name: 'ساعات', value: 'hours' }
                )
        )
        .addStringOption(option =>
            option.setName('الرسالة')
                .setDescription('رسالة العد التنازلي (اختياري)')
                .setRequired(false)
        )
];

// تسجيل الأوامر
const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

(async () => {
    try {
        console.log('🔄 جاري تسجيل الأوامر...');
        
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        
        console.log('✅ تم تسجيل الأوامر بنجاح!');
    } catch (error) {
        console.error('❌ خطأ في تسجيل الأوامر:', error);
    }
})();

// معالج الأحداث
client.once('ready', () => {
    console.log(`🤖 البوت ${client.user.tag} جاهز للعمل!`);
    console.log(`📊 البوت متصل بـ ${client.guilds.cache.size} سيرفر`);
});

// معالج الأوامر والتفاعلات
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

        try {
            if (commandName === 'setup') {
                await handleSetup(interaction);
            } else if (commandName === 'countdown') {
                await handleCountdown(interaction);
            }
        } catch (error) {
        console.error('خطأ في معالجة الأمر:', error);
        await interaction.reply({ 
            content: '❌ حدث خطأ أثناء تنفيذ الأمر!', 
            flags: 64 
        });
        }
    } else if (interaction.isButton()) {
        try {
            if (interaction.customId === 'random_pick') {
                await handleRandomPick(interaction);
            } else if (interaction.customId === 'participants_board') {
                await handleParticipantsBoard(interaction);
            } else if (interaction.customId === 'start_activity') {
                await handleStartActivity(interaction);
            } else if (interaction.customId === 'stop_activity') {
                await handleStopActivity(interaction);
            } else if (interaction.customId.startsWith('activity_')) {
                await handleActivityButton(interaction);
            } else if (interaction.customId === 'share_participant') {
                await handleShareParticipant(interaction);
            } else if (interaction.customId === 'leave_activity') {
                await handleLeaveActivity(interaction);
            } else if (interaction.customId === 'share_result') {
                await handleShareResult(interaction);
            } else if (interaction.customId === 'show_participants') {
                await handleShowParticipants(interaction);
            } else if (interaction.customId.startsWith('pick_')) {
                const count = parseInt(interaction.customId.split('_')[1]);
                await handlePickNumber(interaction, count);
            } else if (interaction.customId === 'back_to_setup') {
                await handleSetup(interaction);
            } else if (interaction.customId === 'stop_countdown') {
                await handleStopCountdown(interaction);
            }
        } catch (error) {
            console.error('خطأ في معالجة الزر:', error);
            await interaction.reply({ 
                content: '❌ حدث خطأ أثناء تنفيذ الزر!', 
                flags: 64 
            });
        }
    }
});

// دالة إعداد البوت
async function handleSetup(interaction) {
    // حذف الرسالة القديمة إذا كانت من زر
    if (interaction.isButton()) {
        try {
            await interaction.message.delete();
        } catch (error) {
            console.error('خطأ في حذف الرسالة القديمة:', error);
        }
    }

    // الحصول على الوقت الحالي للفوتر فقط
    const now = new Date();
    const timeString = now.toLocaleTimeString('ar-SA', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
    });

    const embed = new EmbedBuilder()
        .setTitle('🎯 TKM GIFT SYSTEM')
        .setDescription('مرحباً بك في نظام الفعاليات والهدايا!')
        .setColor('#2C2F33')
        .setImage('https://cdn.discordapp.com/attachments/1369388555423580160/1420655672449564783/benner.png?ex=68d63032&is=68d4deb2&hm=2f2be9242d859bce9ea540a722fe3f60648cf5c1e1535655644c9080ce9e3a9c&')
        .setThumbnail('https://cdn.discordapp.com/attachments/1369388555423580160/1420655640304685097/avatar.png?ex=68d6302b&is=68d4deab&hm=4bc49bca70e061a2cae7d163f5916c944b7b257b4413c085965bcd16d0e24045&')
        .addFields(
            {
                name: '✨ مميزات النظام:',
                value: '• اختيار عشوائي سريع ودقيق\n• تتبع المشاركين في الفعاليات\n• إحصائيات مفصلة للفعاليات\n• واجهة تفاعلية سهلة الاستخدام\n• نظام آمن ومحمي\n❤️ تم تطويره بحب',
                inline: false
            },
            {
                name: '🚀 استخدم الأزرار أدناه للتحكم في النظام',
                value: 'اختر النشاط الذي تريد القيام به من الأزرار أدناه',
                inline: false
            }
        )
        .setTimestamp()
        .setFooter({ 
            text: '🎯 TKM GIFT SYSTEM | Developed by TKM • ' + timeString
        });

    // إنشاء الأزرار الأساسية فقط
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('random_pick')
                .setLabel('اختيار عشوائي')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎲'),
            new ButtonBuilder()
                .setCustomId('participants_board')
                .setLabel('لوحة المشاركين')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('👥')
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('share_participant')
                .setLabel('مشاركة في الفعالية')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📤'),
            new ButtonBuilder()
                .setCustomId('leave_activity')
                .setLabel('الخروج من الفعالية')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🚪')
        );

    if (interaction.isButton()) {
        await interaction.update({ embeds: [embed], components: [row1, row2] });
    } else {
        await interaction.reply({ embeds: [embed], components: [row1, row2] });
    }
}

// دالة اختيار عشوائي من القناة
async function handleRandomPick(interaction) {
    // الحصول على الوقت الحالي
    const now = new Date();
    const timeString = now.toLocaleTimeString('ar-SA', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
    });

    // إنشاء embed لاختيار العدد
    const embed = new EmbedBuilder()
        .setTitle('🎲 الاختيار العشوائي')
        .setDescription('اختر عدد الأشخاص المطلوب اختيارهم من القناة:')
        .setColor('#00D4AA')
        .addFields(
            {
                name: '📋 الخيارات المتاحة:',
                value: '• اختر عدد الأشخاص المطلوب اختيارهم\n• سيتم اختيارهم عشوائياً من القناة\n• يمكنك اختيار من 1 إلى 10 أشخاص',
                inline: false
            },
            {
                name: '⏰ الوقت الحالي',
                value: timeString,
                inline: true
            }
        )
        .setTimestamp()
        .setFooter({ 
            text: '🎯 TKM GIFT SYSTEM | Random Picker • ' + timeString
        });

    // إنشاء أزرار العدد
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('pick_1')
                .setLabel('1 شخص')
                .setStyle(ButtonStyle.Success)
                .setEmoji('1️⃣'),
            new ButtonBuilder()
                .setCustomId('pick_2')
                .setLabel('2 أشخاص')
                .setStyle(ButtonStyle.Success)
                .setEmoji('2️⃣'),
            new ButtonBuilder()
                .setCustomId('pick_3')
                .setLabel('3 أشخاص')
                .setStyle(ButtonStyle.Success)
                .setEmoji('3️⃣'),
            new ButtonBuilder()
                .setCustomId('pick_5')
                .setLabel('5 أشخاص')
                .setStyle(ButtonStyle.Success)
                .setEmoji('5️⃣')
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('pick_10')
                .setLabel('10 أشخاص')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔟'),
            new ButtonBuilder()
                .setCustomId('back_to_setup')
                .setLabel('العودة للقائمة')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⬅️')
        );

    await interaction.reply({ embeds: [embed], components: [row1, row2] });
}

// دالة معالجة أزرار الاختيار العشوائي
async function handlePickNumber(interaction, count) {
    const channelId = interaction.channel.id;
    const channelParticipants = participants.get(channelId);
    
    if (!channelParticipants || channelParticipants.size === 0) {
        await interaction.reply({ 
            content: '❌ لا يوجد مشاركون في الفعالية! اضغط على زر "مشاركة في الفعالية" للانضمام أولاً.', 
            flags: 64 
        });
        return;
    }
    
    if (channelParticipants.size < count) {
        await interaction.reply({ 
            content: `❌ عدد المشاركين (${channelParticipants.size}) أقل من العدد المطلوب (${count})!`, 
            flags: 64 
        });
        return;
    }
    
    // اختيار عشوائي من المشاركين
    const selectedParticipants = getRandomElements(Array.from(channelParticipants), count);
    
    // الحصول على الوقت الحالي
    const now = new Date();
    const timeString = now.toLocaleTimeString('ar-SA', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
    });

    const embed = new EmbedBuilder()
        .setTitle('🎉 النتيجة العشوائية')
        .setColor('#00D4AA')
        .setDescription(`تم اختيار **${count}** مشارك عشوائياً من **${channelParticipants.size}** مشارك:`)
        .addFields(
            {
                name: '🏆 الفائزون:',
                value: selectedParticipants.map((participant, index) => 
                    `**${index + 1}.** <@${participant.id}>`
                ).join('\n'),
                inline: false
            },
            {
                name: '📊 إحصائيات:',
                value: `• إجمالي المشاركين: ${channelParticipants.size}\n• عدد الفائزين: ${count}\n• نسبة الفوز: ${((count / channelParticipants.size) * 100).toFixed(1)}%`,
                inline: true
            },
            {
                name: '⏰ وقت الاختيار',
                value: timeString,
                inline: true
            }
        )
        .setTimestamp()
        .setFooter({ 
            text: '🎯 TKM GIFT SYSTEM | Random Selection • ' + timeString
        });

    // إنشاء الأزرار
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('share_result')
                .setLabel('مشاركة النتيجة')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📤'),
            new ButtonBuilder()
                .setCustomId('participants_board')
                .setLabel('لوحة المشاركين')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👥'),
            new ButtonBuilder()
                .setCustomId('back_to_setup')
                .setLabel('العودة للقائمة')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⬅️')
        );
    
    await interaction.update({ embeds: [embed], components: [row] });
}

// دالة اختيار شخص واحد (قفاوي)
async function handleSinglePick(interaction) {
    const channel = interaction.channel;
    const members = channel.members.filter(member => !member.user.bot);
    
    if (members.size === 0) {
        await interaction.reply({ 
            content: '❌ لا يوجد أعضاء في هذه القناة!', 
            flags: 64 
        });
        return;
    }
    
    const randomMember = getRandomElements(Array.from(members.values()), 1)[0];
    
    const embed = new EmbedBuilder()
        .setTitle('🎯 القفاوي')
        .setColor('#ff6b6b')
        .setDescription(`**${randomMember.user.username}** هو الفائز! 🎉`)
        .setThumbnail(randomMember.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: 'بوت القفاوي العشوائي' });
    
    // إنشاء الأزرار
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('share_result')
                .setLabel('مشاركة النتيجة')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📤'),
            new ButtonBuilder()
                .setCustomId('show_participants')
                .setLabel('لوحة المشاركين')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👥'),
            new ButtonBuilder()
                .setCustomId('start_activity')
                .setLabel('بدء الفعالية')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎯'),
            new ButtonBuilder()
                .setCustomId('back_to_setup')
                .setLabel('العودة للقائمة')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⬅️')
        );
    
    await interaction.update({ embeds: [embed], components: [row] });
}

// دالة اختيار من قائمة مخصصة
async function handleCustomList(interaction) {
    // إنشاء embed لإدخال القائمة
    const embed = new EmbedBuilder()
        .setTitle('📝 قائمة مخصصة')
        .setDescription('يرجى إرسال القائمة في الرسالة التالية مع فصل العناصر بفاصلة (،)\n\nمثال: أحمد، محمد، فاطمة، علي')
        .setColor('#4ecdc4')
        .setTimestamp()
        .setFooter({ text: 'بوت حق عزوزي' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_setup')
                .setLabel('العودة للقائمة')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⬅️')
        );

    await interaction.reply({ embeds: [embed], components: [row] });
}

// دالة معالجة القائمة المخصصة
async function handleCustomListInput(interaction, itemsString, count = 1) {
    
    // تقسيم القائمة
    const items = itemsString.split(/[،,]/).map(item => item.trim()).filter(item => item.length > 0);
    
    if (items.length === 0) {
        await interaction.reply({ 
            content: '❌ القائمة فارغة! تأكد من كتابة العناصر بشكل صحيح.', 
            flags: 64 
        });
        return;
    }
    
    if (items.length < count) {
        await interaction.reply({ 
            content: `❌ عدد العناصر (${items.length}) أقل من العدد المطلوب (${count})!`, 
            flags: 64 
        });
        return;
    }
    
    const selectedItems = getRandomElements(items, count);
    
    const embed = new EmbedBuilder()
        .setTitle('🎲 الاختيار من القائمة المخصصة')
        .setColor('#4ecdc4')
        .setDescription(`تم اختيار ${count} عنصر عشوائياً:`)
        .addFields(
            selectedItems.map((item, index) => ({
                name: `العنصر ${index + 1}`,
                value: item,
                inline: true
            }))
        )
        .setTimestamp()
        .setFooter({ text: 'بوت حق عزوزي' });
    
    // إنشاء الأزرار
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('share_result')
                .setLabel('مشاركة النتيجة')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📤'),
            new ButtonBuilder()
                .setCustomId('show_participants')
                .setLabel('لوحة المشاركين')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👥'),
            new ButtonBuilder()
                .setCustomId('start_activity')
                .setLabel('بدء الفعالية')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎯')
        );
    
    await interaction.reply({ embeds: [embed], components: [row] });
}

// دالة مساعدة للحصول على عناصر عشوائية
function getRandomElements(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

// دالة عرض لوحة المشاركين
async function handleParticipantsBoard(interaction) {
    const channelId = interaction.channel.id;
    const channelParticipants = participants.get(channelId);
    
    if (!channelParticipants || channelParticipants.size === 0) {
        await interaction.reply({ 
            content: '❌ لا يوجد مشاركون في الفعالية بعد! اضغط على زر "مشاركة في الفعالية" للانضمام.', 
            flags: 64 
        });
        return;
    }
    
    // الحصول على الوقت الحالي
    const now = new Date();
    const timeString = now.toLocaleTimeString('ar-SA', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
    });
    
    const participantsList = Array.from(channelParticipants).map((participant, index) => 
        `**${index + 1}.** <@${participant.id}>`
    ).join('\n');
    
    const embed = new EmbedBuilder()
        .setTitle('👥 لوحة المشاركين')
        .setColor('#5865F2')
        .setDescription(`**إجمالي المشاركين: ${channelParticipants.size}**`)
        .addFields(
            {
                name: '📋 قائمة المشاركين:',
                value: participantsList || 'لا يوجد مشاركون',
                inline: false
            },
            {
                name: '📊 إحصائيات:',
                value: `• عدد المشاركين: ${channelParticipants.size}\n• آخر تحديث: ${timeString}`,
                inline: true
            },
            {
                name: '⏰ الوقت الحالي',
                value: timeString,
                inline: true
            }
        )
        .setTimestamp()
        .setFooter({ 
            text: '🎯 TKM GIFT SYSTEM | Participants Board • ' + timeString
        });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('random_pick')
                .setLabel('اختيار عشوائي')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎲'),
            new ButtonBuilder()
                .setCustomId('back_to_setup')
                .setLabel('العودة للقائمة')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⬅️')
        );
    
    await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
}

// دالة الاختيار المخصص بواسطة معرفات الديسكورد
async function handleCustomPick(interaction) {
    // إنشاء embed لإدخال المعرفات
    const embed = new EmbedBuilder()
        .setTitle('🎯 اختيار مخصص')
        .setDescription('يرجى إرسال معرفات الديسكورد في الرسالة التالية مع فصلها بفاصلة (،)\n\nمثال: 123456789، 987654321، 555666777')
        .setColor('#9b59b6')
        .setTimestamp()
        .setFooter({ text: 'بوت حق عزوزي' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_setup')
                .setLabel('العودة للقائمة')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⬅️')
        );

    await interaction.reply({ embeds: [embed], components: [row] });
}

// دالة معالجة الاختيار المخصص
async function handleCustomPickInput(interaction, idsString, count = 1) {
    
    // تقسيم المعرفات
    const ids = idsString.split(/[،,\s]/).map(id => id.trim()).filter(id => id.length > 0);
    
    if (ids.length === 0) {
        await interaction.reply({ 
            content: '❌ لم يتم العثور على معرفات صحيحة!', 
            flags: 64 
        });
        return;
    }
    
    if (ids.length < count) {
        await interaction.reply({ 
            content: `❌ عدد المعرفات (${ids.length}) أقل من العدد المطلوب (${count})!`, 
            flags: 64 
        });
        return;
    }
    
    // اختيار عشوائي من المعرفات
    const selectedIds = getRandomElements(ids, count);
    
    const embed = new EmbedBuilder()
        .setTitle('🎯 الاختيار المخصص')
        .setColor('#9b59b6')
        .setDescription(`تم اختيار ${count} معرف عشوائياً:`)
        .addFields(
            selectedIds.map((id, index) => ({
                name: `المعرف ${index + 1}`,
                value: `\`${id}\``,
                inline: true
            }))
        )
        .setTimestamp()
        .setFooter({ text: 'بوت حق عزوزي' });

    // إنشاء الأزرار
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('share_result')
                .setLabel('مشاركة النتيجة')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📤'),
            new ButtonBuilder()
                .setCustomId('show_participants')
                .setLabel('لوحة المشاركين')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👥'),
            new ButtonBuilder()
                .setCustomId('start_activity')
                .setLabel('بدء الفعالية')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎯')
        );
    
    await interaction.reply({ embeds: [embed], components: [row] });
}

// دالة مشاركة النتيجة
async function handleShareResult(interaction) {
    const originalEmbed = interaction.message.embeds[0];
    
    if (!originalEmbed) {
        await interaction.reply({ 
            content: '❌ لا يمكن العثور على النتيجة للمشاركة!', 
            flags: 64 
        });
        return;
    }
    
    const shareEmbed = new EmbedBuilder()
        .setTitle('📤 نتيجة مشاركة')
        .setDescription(`تم مشاركة هذه النتيجة بواسطة ${interaction.user.username}`)
        .setColor('#e74c3c')
        .setTimestamp()
        .setFooter({ text: 'مشاركة من بوت الاختيار العشوائي' });
    
    await interaction.reply({ 
        content: '✅ تم مشاركة النتيجة!', 
        embeds: [shareEmbed, originalEmbed],
        flags: 64 
    });
}

// دالة عرض المشاركين من الزر
async function handleShowParticipants(interaction) {
    const channel = interaction.channel;
    const members = channel.members.filter(member => !member.user.bot);
    
    if (members.size === 0) {
        await interaction.reply({ 
            content: '❌ لا يوجد أعضاء في هذه القناة!', 
            flags: 64 
        });
        return;
    }
    
    const membersList = Array.from(members.values()).map((member, index) => 
        `**${index + 1}.** ${member.user.username} (${member.user.id})`
    ).join('\n');
    
    const embed = new EmbedBuilder()
        .setTitle('👥 لوحة المشاركين')
        .setColor('#3498db')
        .setDescription(`إجمالي المشاركين: **${members.size}**\n\n${membersList}`)
        .setTimestamp()
        .setFooter({ text: 'بوت حق عزوزي' });
    
    await interaction.reply({ embeds: [embed], flags: 64 });
}

// دالة بدء الفعالية من الزر
async function handleStartActivity(interaction) {
    const channelId = interaction.channel.id;
    
    // التحقق من وجود فعالية نشطة
    if (activeActivities.has(channelId)) {
        await interaction.reply({ 
            content: '⚠️ يوجد فعالية نشطة بالفعل في هذه القناة!', 
            flags: 64 
        });
        return;
    }
    
    // إنشاء embed للفعالية
    const embed = new EmbedBuilder()
        .setTitle('🎯 بدء الفعالية')
        .setDescription('اختر مدة الفعالية:')
        .setColor('#f39c12')
        .setTimestamp()
        .setFooter({ text: 'بوت حق عزوزي' });

    // إنشاء أزرار المدة
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('activity_60')
                .setLabel('1 دقيقة')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⏱️'),
            new ButtonBuilder()
                .setCustomId('activity_120')
                .setLabel('2 دقيقة')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⏱️'),
            new ButtonBuilder()
                .setCustomId('activity_300')
                .setLabel('5 دقائق')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⏱️'),
            new ButtonBuilder()
                .setCustomId('activity_600')
                .setLabel('10 دقائق')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⏱️'),
            new ButtonBuilder()
                .setCustomId('activity_1800')
                .setLabel('30 دقيقة')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⏱️')
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('activity_3600')
                .setLabel('1 ساعة')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🕐'),
            new ButtonBuilder()
                .setCustomId('activity_7200')
                .setLabel('2 ساعة')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🕐'),
            new ButtonBuilder()
                .setCustomId('activity_21600')
                .setLabel('6 ساعات')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🕐'),
            new ButtonBuilder()
                .setCustomId('activity_43200')
                .setLabel('12 ساعة')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🕐'),
            new ButtonBuilder()
                .setCustomId('back_to_setup')
                .setLabel('العودة للقائمة')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⬅️')
        );

    await interaction.update({ embeds: [embed], components: [row1, row2] });
}

// دالة معالجة أزرار الفعالية
async function handleActivityButton(interaction) {
    const duration = parseInt(interaction.customId.split('_')[1]);
    const channelId = interaction.channel.id;
    const count = 1; // يمكن تعديله لاحقاً
    
    // طلب اسم الفعالية
    const embed = new EmbedBuilder()
        .setTitle('📝 إدخال اسم الفعالية')
        .setDescription('اكتب اسم الفعالية التي تريدها:')
        .setColor('#3498db')
        .setTimestamp()
        .setFooter({ text: 'بوت حق عزوزي' });

    await interaction.update({ embeds: [embed], components: [] });
    
    // انتظار رد المستخدم
    const filter = m => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });
    
    collector.on('collect', async (message) => {
        const activityName = message.content;
        await message.delete(); // حذف رسالة المستخدم
        
        // بدء الفعالية مع الاسم
        await startActivity(interaction, duration, count, activityName);
    });
    
    collector.on('end', async (collected) => {
        if (collected.size === 0) {
            await interaction.followUp({ 
                content: '⏰ انتهى الوقت! لم يتم إدخال اسم الفعالية.', 
                flags: 64 
            });
        }
    });
}

// دالة بدء الفعالية الفعلية
async function startActivity(interaction, duration, count, activityName = 'الفعالية') {
    const channelId = interaction.channel.id;
    const channel = interaction.channel;
    
    // جلب الأعضاء
    const members = channel.members.filter(member => !member.user.bot);
    
    if (members.size === 0) {
        await interaction.reply({ 
            content: '❌ لا يوجد أعضاء في هذه القناة!', 
            flags: 64 
        });
        return;
    }
    
    if (members.size < count) {
        await interaction.reply({ 
            content: `❌ عدد الأعضاء (${members.size}) أقل من العدد المطلوب (${count})!`, 
            flags: 64 
        });
        return;
    }
    
    // حفظ الفعالية النشطة
    const activityId = `${channelId}_${Date.now()}`;
    activeActivities.set(channelId, {
        id: activityId,
        duration: duration,
        count: count,
        members: Array.from(members.values()),
        startTime: Date.now(),
        intervalId: null
    });
    
    // إنشاء embed العد التنازلي
    const embed = new EmbedBuilder()
        .setTitle(`⏰ ${activityName} - جارية...`)
        .setDescription(`**الوقت المتبقي: ${formatTime(duration)}**\n\n🎯 سيتم اختيار ${count} شخص عشوائياً بعد انتهاء الوقت!`)
        .setColor('#e74c3c')
        .setTimestamp()
        .setFooter({ text: 'بوت حق عزوزي' });

    // إنشاء أزرار التحكم
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stop_activity')
                .setLabel('إيقاف الفعالية')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⏹️')
        );

    const message = await interaction.reply({ embeds: [embed], components: [row] });
    
    // بدء العد التنازلي
    startCountdown(channelId, duration, message, count, activityName);
}

// دالة العد التنازلي
function startCountdown(channelId, duration, message, count, activityName = 'الفعالية') {
    const activity = activeActivities.get(channelId);
    if (!activity) return;
    
    let remainingTime = duration;
    
    const updateInterval = setInterval(async () => {
        remainingTime--;
        
        if (remainingTime <= 0) {
            // انتهاء الوقت - اختيار عشوائي
            clearInterval(updateInterval);
            activeActivities.delete(channelId);
            await performFinalSelection(message, activity.members, count, activityName);
            return;
        }
        
        // تحديث الرسالة
        const embed = new EmbedBuilder()
            .setTitle(`⏰ ${activityName} - جارية...`)
            .setDescription(`**الوقت المتبقي: ${formatTime(remainingTime)}**\n\n🎯 سيتم اختيار ${count} شخص عشوائياً بعد انتهاء الوقت!`)
            .setColor(remainingTime <= 10 ? '#e74c3c' : '#f39c12')
            .setTimestamp()
            .setFooter({ text: 'بوت حق عزوزي' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('stop_activity')
                    .setLabel('إيقاف الفعالية')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('⏹️')
            );

        try {
            await message.edit({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('خطأ في تحديث الرسالة:', error);
        }
    }, 1000);
    
    // حفظ معرف الفاصل الزمني
    activity.intervalId = updateInterval;
}

// دالة الاختيار النهائي
async function performFinalSelection(message, members, count, activityName = 'الفعالية') {
    const selectedMembers = getRandomElements(members, count);
    
    const embed = new EmbedBuilder()
        .setTitle(`🎉 انتهت ${activityName}!`)
        .setColor('#27ae60')
        .setDescription(`تم اختيار ${count} شخص عشوائياً:`)
        .addFields(
            selectedMembers.map((member, index) => ({
                name: `الفائز ${index + 1}`,
                value: `<@${member.user.id}>`,
                inline: true
            }))
        )
        .setTimestamp()
        .setFooter({ text: 'بوت حق عزوزي' });

    // إنشاء أزرار النتيجة
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('share_result')
                .setLabel('مشاركة النتيجة')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📤'),
            new ButtonBuilder()
                .setCustomId('show_participants')
                .setLabel('لوحة المشاركين')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👥'),
            new ButtonBuilder()
                .setCustomId('start_activity')
                .setLabel('بدء فعالية جديدة')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎯')
        );

    try {
        await message.edit({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('خطأ في تحديث الرسالة النهائية:', error);
    }
}

// دالة إيقاف الفعالية
async function handleStopActivity(interaction) {
    const channelId = interaction.channel.id;
    const activity = activeActivities.get(channelId);
    
    if (!activity) {
        await interaction.reply({ 
            content: '❌ لا توجد فعالية نشطة في هذه القناة!', 
            flags: 64 
        });
        return;
    }
    
    // إيقاف الفاصل الزمني
    if (activity.intervalId) {
        clearInterval(activity.intervalId);
    }
    
    // حذف الفعالية
    activeActivities.delete(channelId);
    
    const embed = new EmbedBuilder()
        .setTitle('⏹️ تم إيقاف الفعالية')
        .setDescription('تم إيقاف الفعالية بواسطة المستخدم')
        .setColor('#95a5a6')
        .setTimestamp()
        .setFooter({ text: 'بوت حق عزوزي' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('start_activity')
                .setLabel('بدء فعالية جديدة')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎯')
        );

    await interaction.update({ embeds: [embed], components: [row] });
}

// دالة بدء الفعالية من الأمر
async function handleActivity(interaction) {
    const duration = interaction.options.getInteger('المدة');
    const count = interaction.options.getInteger('عدد') || 1;
    
    await startActivity(interaction, duration, count);
}

// دالة مشاركة المشارك في الفعالية
async function handleShareParticipant(interaction) {
    const channelId = interaction.channel.id;
    const userId = interaction.user.id;
    const username = interaction.user.username;
    
    // إضافة المشارك إلى القائمة
    if (!participants.has(channelId)) {
        participants.set(channelId, new Set());
    }
    
    const channelParticipants = participants.get(channelId);
    channelParticipants.add({
        id: userId,
        username: username,
        joinedAt: new Date()
    });
    
    // إنشاء قائمة المشاركين
    const participantsList = Array.from(channelParticipants).map((participant, index) => 
        `**${index + 1}.** <@${participant.id}> (انضم: ${participant.joinedAt.toLocaleTimeString('ar-SA')})`
    ).join('\n');
    
    const embed = new EmbedBuilder()
        .setTitle('📤 تم الانضمام للفعالية!')
        .setDescription(`<@${userId}> انضم للفعالية! 🎉`)
        .setColor('#27ae60')
        .addFields({
            name: `👥 المشاركون (${channelParticipants.size})`,
            value: participantsList || 'لا يوجد مشاركون بعد',
            inline: false
        })
        .setTimestamp()
        .setFooter({ text: 'بوت حق عزوزي' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_setup')
                .setLabel('العودة للقائمة')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⬅️')
        );

    await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
}

// دالة الخروج من الفعالية
async function handleLeaveActivity(interaction) {
    const channelId = interaction.channel.id;
    const userId = interaction.user.id;
    const username = interaction.user.username;
    
    // التحقق من وجود مشاركين في القناة
    if (!participants.has(channelId)) {
        await interaction.reply({ 
            content: '❌ لا توجد فعالية نشطة في هذه القناة!', 
            flags: 64 
        });
        return;
    }
    
    const channelParticipants = participants.get(channelId);
    
    // البحث عن المشارك وحذفه
    let participantFound = false;
    for (const participant of channelParticipants) {
        if (participant.id === userId) {
            channelParticipants.delete(participant);
            participantFound = true;
            break;
        }
    }
    
    if (!participantFound) {
        await interaction.reply({ 
            content: '❌ أنت لست مشاركاً في الفعالية!', 
            flags: 64 
        });
        return;
    }
    
    // إنشاء قائمة المشاركين المحدثة
    const participantsList = Array.from(channelParticipants).map((participant, index) => 
        `**${index + 1}.** <@${participant.id}> (انضم: ${participant.joinedAt.toLocaleTimeString('ar-SA')})`
    ).join('\n');
    
    const embed = new EmbedBuilder()
        .setTitle('🚪 تم الخروج من الفعالية')
        .setDescription(`<@${userId}> خرج من الفعالية! 👋`)
        .setColor('#e74c3c')
        .addFields({
            name: `👥 المشاركون المتبقون (${channelParticipants.size})`,
            value: participantsList || 'لا يوجد مشاركون الآن',
            inline: false
        })
        .setTimestamp()
        .setFooter({ text: 'بوت حق عزوزي' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_setup')
                .setLabel('العودة للقائمة')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⬅️')
        );

    await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
}

// دالة العد التنازلي
async function handleCountdown(interaction) {
    const time = interaction.options.getInteger('الوقت');
    const type = interaction.options.getString('النوع');
    const message = interaction.options.getString('الرسالة') || 'العد التنازلي';
    
    // تحويل الوقت إلى ثواني
    let totalSeconds;
    if (type === 'minutes') {
        totalSeconds = time * 60;
    } else if (type === 'hours') {
        totalSeconds = time * 60 * 60;
    }
    
    // التحقق من الحد الأقصى (24 ساعة)
    if (totalSeconds > 86400) {
        await interaction.reply({ 
            content: '❌ الحد الأقصى للعد التنازلي هو 24 ساعة!', 
            flags: 64 
        });
        return;
    }
    
    // إنشاء embed العد التنازلي
    const embed = new EmbedBuilder()
        .setTitle('⏰ العد التنازلي')
        .setDescription(`**${message}**\n\nالوقت المتبقي: **${formatTime(totalSeconds)}**`)
        .setColor('#e74c3c')
        .setTimestamp()
        .setFooter({ text: 'بوت حق عزوزي' });

    // إنشاء أزرار التحكم
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stop_countdown')
                .setLabel('إيقاف العد التنازلي')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⏹️')
        );

    await interaction.reply({ embeds: [embed], components: [row] });
    
    // بدء العد التنازلي
    startCountdownTimer(interaction, totalSeconds, message);
}

// دالة بدء العد التنازلي
function startCountdownTimer(interaction, totalSeconds, customMessage) {
    let remainingTime = totalSeconds;
    const channelId = interaction.channel.id;
    
    const updateInterval = setInterval(async () => {
        remainingTime--;
        
        if (remainingTime <= 0) {
            // انتهاء العد التنازلي
            clearInterval(updateInterval);
            activeCountdowns.delete(channelId);
            
            const finalEmbed = new EmbedBuilder()
                .setTitle('🎉 انتهى العد التنازلي!')
                .setDescription(`**${customMessage}**\n\n⏰ **انتهى الوقت!**`)
                .setColor('#27ae60')
                .setTimestamp()
                .setFooter({ text: 'بوت حق عزوزي' });

            try {
                await interaction.editReply({ embeds: [finalEmbed], components: [] });
            } catch (error) {
                console.error('خطأ في تحديث الرسالة النهائية:', error);
            }
            return;
        }
        
        // تحديث الرسالة
        const embed = new EmbedBuilder()
            .setTitle('⏰ العد التنازلي')
            .setDescription(`**${customMessage}**\n\nالوقت المتبقي: **${formatTime(remainingTime)}**`)
            .setColor(remainingTime <= 60 ? '#e74c3c' : remainingTime <= 300 ? '#f39c12' : '#3498db')
            .setTimestamp()
            .setFooter({ text: 'بوت حق عزوزي' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('stop_countdown')
                    .setLabel('إيقاف العد التنازلي')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('⏹️')
            );

        try {
            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('خطأ في تحديث الرسالة:', error);
            clearInterval(updateInterval);
            activeCountdowns.delete(channelId);
        }
    }, 1000);
    
    // حفظ معرف الفاصل الزمني
    activeCountdowns.set(channelId, updateInterval);
}

// دالة تنسيق الوقت
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}س ${minutes}د ${secs}ث`;
    } else if (minutes > 0) {
        return `${minutes}د ${secs}ث`;
    } else {
        return `${secs}ث`;
    }
}

// دالة إيقاف العد التنازلي
async function handleStopCountdown(interaction) {
    const channelId = interaction.channel.id;
    
    // التحقق من وجود عد تنازلي نشط
    if (!activeCountdowns.has(channelId)) {
        await interaction.reply({ 
            content: '❌ لا يوجد عد تنازلي نشط في هذه القناة!', 
            flags: 64 
        });
        return;
    }
    
    // إيقاف العد التنازلي
    const intervalId = activeCountdowns.get(channelId);
    clearInterval(intervalId);
    activeCountdowns.delete(channelId);
    
    const embed = new EmbedBuilder()
        .setTitle('⏹️ تم إيقاف العد التنازلي')
        .setDescription('تم إيقاف العد التنازلي بواسطة المستخدم')
        .setColor('#95a5a6')
        .setTimestamp()
        .setFooter({ text: 'بوت حق عزوزي' });

    await interaction.update({ embeds: [embed], components: [] });
}

// دالة الاختيار المخصص من الزر (سيتم تطويرها لاحقاً)
async function handleCustomPickModal(interaction) {
    await interaction.reply({ 
        content: '🎯 استخدم الأمر `/اختيار_مخصص` لاختيار أشخاص محددين بواسطة معرفات الديسكورد!', 
        flags: 64 
    });
}

// تسجيل الدخول
client.login(BOT_TOKEN);
