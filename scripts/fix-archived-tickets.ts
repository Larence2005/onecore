// Script to fix archived tickets that don't have archivedAt timestamp
// Run this once to fix existing data

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixArchivedTickets() {
    try {
        console.log('Checking for archived tickets without archivedAt timestamp...');
        
        // Find tickets that are ARCHIVED but don't have archivedAt set
        const brokenTickets = await prisma.ticket.findMany({
            where: {
                status: 'ARCHIVED',
                archivedAt: null,
            },
            select: {
                id: true,
                ticketNumber: true,
                subject: true,
                updatedAt: true,
            },
        });

        console.log(`Found ${brokenTickets.length} archived tickets without archivedAt timestamp`);

        if (brokenTickets.length > 0) {
            console.log('Fixing tickets:', brokenTickets.map(t => `#${t.ticketNumber}`).join(', '));
            
            // Update them to have archivedAt = updatedAt (best guess)
            const result = await prisma.ticket.updateMany({
                where: {
                    status: 'ARCHIVED',
                    archivedAt: null,
                },
                data: {
                    archivedAt: new Date(), // Set to now since we don't know when they were archived
                },
            });

            console.log(`✅ Fixed ${result.count} tickets`);
        } else {
            console.log('✅ No broken tickets found. All archived tickets have archivedAt timestamp.');
        }

        // Also check for tickets with archivedAt but status is not ARCHIVED
        const inconsistentTickets = await prisma.ticket.findMany({
            where: {
                status: { not: 'ARCHIVED' },
                archivedAt: { not: null },
            },
            select: {
                id: true,
                ticketNumber: true,
                status: true,
            },
        });

        if (inconsistentTickets.length > 0) {
            console.log(`⚠️  Found ${inconsistentTickets.length} tickets with archivedAt but status is not ARCHIVED`);
            console.log('Tickets:', inconsistentTickets.map(t => `#${t.ticketNumber} (${t.status})`).join(', '));
            
            // Clear archivedAt for these tickets
            const result = await prisma.ticket.updateMany({
                where: {
                    status: { not: 'ARCHIVED' },
                    archivedAt: { not: null },
                },
                data: {
                    archivedAt: null,
                },
            });

            console.log(`✅ Cleared archivedAt for ${result.count} tickets`);
        }

    } catch (error) {
        console.error('Error fixing archived tickets:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

fixArchivedTickets();
